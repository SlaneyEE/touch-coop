import QRCode from "qrcode";
import { compressOfferData } from "./encoding";

export interface BasePlayerEvent {
  playerId: string;
  timestamp: number;
}

export interface JoinLeaveEvent {
  action: "JOIN" | "LEAVE";
}

export interface MoveEvent {
  action: "MOVE";
  button: string;
}

export type PlayerEvent = (JoinLeaveEvent | MoveEvent) & BasePlayerEvent;

type OnPlayerEventHandler = (data: PlayerEvent) => void;

export class Match {
  private _playerConnections: Map<string, RTCPeerConnection> = new Map();
  private _playerChannels: Map<string, RTCDataChannel> = new Map();
  private _invitationAccepted: Map<string, boolean> = new Map();
  private _onPlayerEvent: OnPlayerEventHandler | null = null;
  private _gamepadUiUrl: string;
  constructor(gamepadUiUrl: string, onPlayerEvent: OnPlayerEventHandler) {
    this._onPlayerEvent = onPlayerEvent;
    this._gamepadUiUrl = gamepadUiUrl;
    const channel = new BroadcastChannel("touch-coop-signaling");
    channel.onmessage = async (event) => {
      const data = event.data;
      if (
        data &&
        data.type === "answer" &&
        data.playerId &&
        data.base64Answer
      ) {
        try {
          const pc = this._playerConnections.get(data.playerId);
          if (!pc) {
            throw new Error(`No peer connection for player: ${data.playerId}`);
          }
          const answerObject = JSON.parse(atob(data.base64Answer));
          await pc.setRemoteDescription(answerObject.sdp);
          // Mark invitation as accepted
          this._invitationAccepted.set(data.playerId, true);
        } catch (err) {}
      }
    };
  }
  private _UUIID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  async requestNewPlayerToJoin() {
    return new Promise<{ dataUrl: string; playerId: string; shareURL: string }>(
      (resolve, reject) => {
        (async () => {
          const newPlayer = this._UUIID();
          const pc = new RTCPeerConnection();
          const dataChannel = pc.createDataChannel("player");
          this._playerConnections.set(newPlayer, pc);
          this._playerChannels.set(newPlayer, dataChannel);
          this._invitationAccepted.set(newPlayer, false);
          dataChannel.onmessage = (msg) => {
            if (this._onPlayerEvent) {
              let eventData = msg.data;
              eventData = JSON.parse(msg.data);
              this._onPlayerEvent(eventData);
            }
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await new Promise((resolveIce) => {
            pc.onicecandidate = (event) => {
              if (!event.candidate) {
                resolveIce(void 0);
              }
            };
          });
          const offerObject = {
            playerId: newPlayer,
            sdp: pc.localDescription,
          };
          const offerJSON = JSON.stringify(offerObject);
          const compressedBase64OfferObject =
            await compressOfferData(offerJSON);
          const shareURL = `${this._gamepadUiUrl}?remoteSDP=${compressedBase64OfferObject}`;
          QRCode.toDataURL(
            shareURL,
            { errorCorrectionLevel: "M" },
            (err, dataUrl) => {
              if (err) {
                return reject(err);
              }
              resolve({
                dataUrl: dataUrl,
                shareURL: shareURL,
                playerId: newPlayer,
              });
            },
          );
        })();
      },
    );
  }

  // Returns true if invitation was accepted, false if still pending, undefined if not found
  getInvitationStatus(playerId: string): boolean | undefined {
    return this._invitationAccepted.get(playerId);
  }
  async acceptPlayerAnswer(playerId: string, base64Answer: string) {}
}

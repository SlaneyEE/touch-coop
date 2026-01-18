import type { PlayerEvent } from "./match";

export class Player {
  private _pc: RTCPeerConnection;
  private _playerId: string | null = null;
  private _dataChannel: RTCDataChannel | null = null;
  constructor() {
    this._pc = new RTCPeerConnection();
    this._pc.ondatachannel = (event) => {
      this._dataChannel = event.channel;
      this._dataChannel.onopen = () => {
        if (this._playerId && this._dataChannel) {
          const joinEvent = {
            playerId: this._playerId,
            action: "JOIN",
            timestamp: Date.now(),
          };
          this._dataChannel.send(JSON.stringify(joinEvent));
        }
      };
    };
    window.addEventListener("beforeunload", () => {
      if (
        this._dataChannel &&
        this._dataChannel.readyState === "open" &&
        this._playerId
      ) {
        const leaveEvent = {
          playerId: this._playerId,
          action: "LEAVE",
          button: "",
          timestamp: Date.now(),
        };
        try {
          this._dataChannel.send(JSON.stringify(leaveEvent));
        } catch {}
      }
    });
  }
  async joinMatch() {
    const params = new URLSearchParams(window.location.search);
    const remoteBase64 = params.get("remoteSDP");
    if (!remoteBase64) {
      throw new Error("No remoteSDP found in URL parameters.");
    }
    const remoteObject = JSON.parse(atob(remoteBase64));
    this._playerId = remoteObject.playerId;
    const remoteSDP = remoteObject.sdp;
    await this._pc.setRemoteDescription(remoteSDP);
    if (remoteSDP.type === "offer") {
      const answer = await this._pc.createAnswer();
      await this._pc.setLocalDescription(answer);
      await new Promise((resolve) => {
        this._pc.onicecandidate = (event) => {
          if (!event.candidate) {
            resolve(void 0);
          }
        };
      });
      const answerObject = {
        playerId: this._playerId,
        sdp: this._pc.localDescription,
      };
      const answerJSON = JSON.stringify(answerObject);
      const base64AnswerObject = btoa(answerJSON);
      const channel = new BroadcastChannel("touch-coop-signaling");
      const msg = {
        type: "answer",
        playerId: this._playerId,
        base64Answer: base64AnswerObject,
      };
      channel.postMessage(msg);
      channel.close();
    }
  }
  async sendMove(button: string) {
    if (this._dataChannel && this._dataChannel.readyState === "open") {
      if (!this._playerId) {
        throw new Error("Player ID is not set. Cannot send data.");
      }
      const playerEvent: PlayerEvent = {
        playerId: this._playerId,
        action: "MOVE",
        button: button,
        timestamp: Date.now(),
      };
      const playerEventJSON = JSON.stringify(playerEvent);
      this._dataChannel.send(playerEventJSON);
    } else {
      console.warn("Data channel is not open. Cannot send data.");
    }
  }
}

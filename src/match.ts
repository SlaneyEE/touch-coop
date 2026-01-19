import Peer, { type DataConnection, type PeerOptions } from "peerjs";
import QRCode from "qrcode";

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
  private _peer: Peer;
  private _playerConnections: Map<string, DataConnection> = new Map();
  private _invitationAccepted: Map<string, boolean> = new Map();
  private _connectionToPlayerId: Map<DataConnection, string> = new Map();
  private _onPlayerEvent: OnPlayerEventHandler | null = null;
  private _gamepadUiUrl: string;

  constructor(
    gamepadUiUrl: string,
    onPlayerEvent: OnPlayerEventHandler,
    peerConfig?: PeerOptions,
  ) {
    this._onPlayerEvent = onPlayerEvent;
    this._gamepadUiUrl = gamepadUiUrl;

    this._peer = peerConfig ? new Peer(peerConfig) : new Peer();

    this._peer.on("open", (hostId) => {
      console.log(`Host PeerJS ID: ${hostId}`);
    });

    this._peer.on("connection", (conn: DataConnection) => {
      conn.on("open", () => {
        console.log(`Connection open for PeerJS ID: ${conn.peer}`);
      });

      conn.on("data", (rawData: unknown) => {
        if (this._onPlayerEvent) {
          let eventData: PlayerEvent;
          if (typeof rawData === "string") {
            try {
              eventData = JSON.parse(rawData);
            } catch {
              console.warn("Invalid JSON from player", conn.peer, rawData);
              return;
            }
          } else if (typeof rawData === "object" && rawData !== null) {
            eventData = rawData as PlayerEvent;
          } else {
            console.warn(
              "Unexpected data type from player",
              conn.peer,
              rawData,
            );
            return;
          }

          let playerId: string | undefined;
          if (
            "playerId" in eventData &&
            typeof eventData.playerId === "string"
          ) {
            playerId = eventData.playerId;
          }
          if (playerId === undefined) {
            console.warn("Malformed event from player", conn.peer, eventData);
            return;
          }
          eventData.playerId = playerId;

          if ("action" in eventData && "timestamp" in eventData) {
            if (eventData.action === "JOIN") {
              this._playerConnections.set(eventData.playerId, conn);
              this._invitationAccepted.set(eventData.playerId, true);
              this._connectionToPlayerId.set(conn, eventData.playerId);
              console.log(`Player ${eventData.playerId} joined`);
            }
            this._onPlayerEvent(eventData);
          } else {
            console.warn("Malformed event from player", conn.peer, eventData);
          }
        }
      });

      conn.on("close", () => {
        const playerId = this._connectionToPlayerId.get(conn);
        if (playerId !== undefined) {
          this._playerConnections.delete(playerId);
          this._invitationAccepted.delete(playerId);
          this._connectionToPlayerId.delete(conn);
          if (this._onPlayerEvent) {
            this._onPlayerEvent({
              playerId,
              action: "LEAVE",
              timestamp: Date.now(),
            });
          }
          console.log(`Player ${playerId} disconnected`);
        } else {
          console.log(
            `Connection closed for unknown player (PeerJS ID: ${conn.peer})`,
          );
        }
      });

      conn.on("error", (err) => {
        const playerId = this._connectionToPlayerId.get(conn);
        if (playerId !== undefined) {
          console.error(`Connection error for player ${playerId}:`, err);
          this._playerConnections.delete(playerId);
          this._invitationAccepted.delete(playerId);
          this._connectionToPlayerId.delete(conn);
        } else {
          console.error(
            `Connection error for unknown player (PeerJS ID: ${conn.peer}):`,
            err,
          );
        }
      });
    });

    this._peer.on("error", (err) => {
      console.error("PeerJS error:", err);
    });
  }

  async requestNewPlayerToJoin(): Promise<{
    dataUrl: string;
    shareURL: string;
  }> {
    return new Promise((resolve, reject) => {
      if (this._peer.destroyed || !this._peer.open) {
        return reject(new Error("Host Peer is not open or has been destroyed"));
      }

      const hostId = this._peer.id;
      if (!hostId) {
        return reject(new Error("Host Peer ID not yet assigned"));
      }

      const shareURL = `${this._gamepadUiUrl}?hostPeerId=${encodeURIComponent(hostId)}`;

      QRCode.toDataURL(
        shareURL,
        { errorCorrectionLevel: "M" },
        (err, dataUrl) => {
          if (err) return reject(err);

          resolve({
            dataUrl,
            shareURL,
          });
        },
      );
    });
  }

  getInvitationStatus(playerId: string): boolean | undefined {
    return this._invitationAccepted.get(playerId);
  }

  destroy() {
    for (const playerId of this._playerConnections.keys()) {
      this._invitationAccepted.delete(playerId);
    }
    this._playerConnections.clear();
    this._invitationAccepted.clear();
    this._connectionToPlayerId.clear();
    this._peer.destroy();
  }
}

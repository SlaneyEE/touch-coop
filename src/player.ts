import Peer, { type DataConnection, type PeerOptions } from "peerjs";
import type { PlayerEvent } from "./match";

export class Player {
  private _peer: Peer;
  private _playerId: string | null = null;
  private _dataConnection: DataConnection | null = null;
  private _ownIdPromise: Promise<string>;

  constructor(peerConfig?: PeerOptions) {
    this._peer = peerConfig ? new Peer(peerConfig) : new Peer();

    this._ownIdPromise = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Peer ID not assigned in time")),
        10000,
      );
      this._peer.on("open", (id) => {
        clearTimeout(timeout);
        this._playerId = id;
        resolve(id);
      });
      this._peer.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    this._peer.on("error", (err) => {
      console.error("PeerJS error:", err.type, err.message);
    });

    window.addEventListener("beforeunload", () => {
      if (this._dataConnection?.open && this._playerId !== null) {
        const leaveEvent: PlayerEvent = {
          playerId: this._playerId,
          action: "LEAVE",
          timestamp: Date.now(),
        };
        try {
          this._dataConnection.send(leaveEvent);
        } catch (err) {
          console.warn("Failed to send LEAVE:", err);
        }
      }
      this._dataConnection?.close();
      this._peer.destroy();
    });
  }

  async joinMatch() {
    const params = new URLSearchParams(window.location.search);
    const hostPeerId = params.get("hostPeerId");
    if (!hostPeerId) {
      throw new Error("No hostPeerId found in URL parameters.");
    }

    const conn = this._peer.connect(hostPeerId, {
      reliable: false,
    });

    this._dataConnection = conn;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        conn.close();
        reject(new Error("Connection timeout"));
      }, 15000);

      conn.on("open", () => {
        clearTimeout(timeout);
        if (this._playerId) {
          const joinEvent: PlayerEvent = {
            playerId: this._playerId,
            action: "JOIN",
            timestamp: Date.now(),
          };
          conn.send(joinEvent);
          console.log("JOIN sent, data connection open");
          resolve();
        } else {
          this._ownIdPromise
            .then((playerId) => {
              const joinEvent: PlayerEvent = {
                playerId,
                action: "JOIN",
                timestamp: Date.now(),
              };
              conn.send(joinEvent);
              console.log("JOIN sent, data connection open");
              resolve();
            })
            .catch(reject);
        }
      });

      conn.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    conn.on("data", (data: unknown) => {
      console.log("Received from host:", data);
    });

    conn.on("close", () => {
      console.log("Data connection closed by host");
      this._dataConnection = null;
    });
  }

  async sendMove(button: string) {
    if (this._dataConnection?.open) {
      if (this._playerId === null) {
        throw new Error("Player ID is not set. Cannot send data.");
      }
      const playerEvent: PlayerEvent = {
        playerId: this._playerId,
        action: "MOVE",
        button: button,
        timestamp: Date.now(),
      };
      this._dataConnection.send(playerEvent);
    } else {
      console.warn("Data connection is not open. Cannot send move.");
    }
  }

  get isConnected(): boolean {
    return !!this._dataConnection?.open;
  }

  destroy() {
    this._dataConnection?.close();
    this._peer.destroy();
  }
}

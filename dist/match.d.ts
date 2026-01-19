import { type PeerOptions } from "peerjs";
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
export declare class Match {
    private _peer;
    private _playerConnections;
    private _invitationAccepted;
    private _connectionToPlayerId;
    private _onPlayerEvent;
    private _gamepadUiUrl;
    constructor(gamepadUiUrl: string, onPlayerEvent: OnPlayerEventHandler, peerConfig?: PeerOptions);
    requestNewPlayerToJoin(): Promise<{
        dataUrl: string;
        shareURL: string;
    }>;
    getInvitationStatus(playerId: string): boolean | undefined;
    destroy(): void;
}
export {};
//# sourceMappingURL=match.d.ts.map
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
    private _playerConnections;
    private _playerChannels;
    private _invitationAccepted;
    private _onPlayerEvent;
    private _gamepadUiUrl;
    constructor(gamepadUiUrl: string, onPlayerEvent: OnPlayerEventHandler);
    private _UUIID;
    requestNewPlayerToJoin(): Promise<{
        dataUrl: string;
        playerId: string;
        shareURL: string;
    }>;
    getInvitationStatus(playerId: string): boolean | undefined;
    acceptPlayerAnswer(playerId: string, base64Answer: string): Promise<void>;
}
export {};
//# sourceMappingURL=match.d.ts.map
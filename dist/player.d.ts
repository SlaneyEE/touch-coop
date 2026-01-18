export declare class Player {
    private _pc;
    private _playerId;
    private _dataChannel;
    constructor();
    joinMatch(): Promise<void>;
    sendMove(button: string): Promise<void>;
}
//# sourceMappingURL=player.d.ts.map
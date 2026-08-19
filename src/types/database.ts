export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
export type PlayerRole = "initiator" | "responder";
export type Marker = "X" | "O";

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          slug: string;
          game_type: string;
          state: Json;
          status: GameStatus;
          created_at: number;
          updated_at: number;
        };
        Insert: {
          id?: string;
          slug: string;
          game_type: string;
          state: Json;
          status: GameStatus;
          created_at: number;
          updated_at: number;
        };
        Update: {
          slug?: string;
          game_type?: string;
          state?: Json;
          status?: GameStatus;
          updated_at?: number;
        };
      };
      players: {
        Row: {
          id: string;
          game_id: string;
          device_token: string;
          role: PlayerRole;
          marker: Marker;
          joined_at: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          device_token: string;
          role: PlayerRole;
          marker: Marker;
          joined_at: number;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
      };
      moves: {
        Row: {
          id: string;
          game_id: string;
          player_id: string;
          payload: Json;
          created_at: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id: string;
          payload: Json;
          created_at: number;
        };
        Update: Partial<Database["public"]["Tables"]["moves"]["Insert"]>;
      };
      feedback: {
        Row: {
          id: string;
          game_id: string;
          felt_natural: boolean | null;
          would_play_again: boolean | null;
          created_at: number;
        };
        Insert: {
          id?: string;
          game_id: string;
          felt_natural?: boolean | null;
          would_play_again?: boolean | null;
          created_at: number;
        };
        Update: Partial<Database["public"]["Tables"]["feedback"]["Insert"]>;
      };
    };
  };
}

export type GameRow = Database["public"]["Tables"]["games"]["Row"];
export type PlayerRow = Database["public"]["Tables"]["players"]["Row"];

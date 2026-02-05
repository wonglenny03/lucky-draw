
export interface Participant {
  id: string;
  name: string;
  department?: string;
  avatar?: string;
}

export interface Prize {
  id: string;
  name: string;
  rank: number;
  count: number;
  remaining: number;
  image?: string;
}

export interface Winner {
  participant: Participant;
  prize: Prize;
  drawTime: string;
  isExtra?: boolean;
}

export interface AppState {
  participants: Participant[]; // Remaining pool for regular draw
  allParticipants: Participant[]; // Original full list for extra draw
  prizes: Prize[];
  extraPrizes: Prize[];
  winners: Winner[];
  currentPrizeId: string | null;
  isExtraMode: boolean; // Tracks if we are currently looking at the extra draw screen
  extraModeEnabled: boolean; // Tracks if the extra draw feature is "unlocked" in settings
  backgroundImage?: string; // Full-screen background image URL or data URL
  backgroundMusic?: string; // Background music MP3 URL or data URL
  drawMusic?: string; // Music played during draw (rolling)
  winnerSound?: string; // Sound effect when winners are revealed
}

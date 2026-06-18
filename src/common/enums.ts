export enum UserRole {
  ADMIN = 'admin',
  CANDIDATE = 'candidate',
  PUBLIC = 'public',
}

export enum TeamStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum PlayerRank {
  PLAT3 = 'plat3',
  PLAT4 = 'plat4',
  DIA1 = 'dia1',
  DIA2 = 'dia2',
  DIA3 = 'dia3',
  CHAMP1 = 'champ1',
  CHAMP2 = 'champ2',
  CHAMP3 = 'champ3',
}

export enum MatchPhase {
  GROUPS = 'groups',
  ROUND16 = 'round16',
  QUARTERS = 'quarters',
  SEMIS = 'semis',
  THIRD = 'third',
  FINAL = 'final',
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  FINISHED = 'finished',
}

export enum MatchFormat {
  BO3 = 'bo3',
  BO5 = 'bo5',
  BO7 = 'bo7',
}

export enum TransactionType {
  EARNED = 'earned',
  SPENT = 'spent',
  ADMIN_GRANT = 'admin_grant',
}

export enum RedemptionStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum RegistrationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

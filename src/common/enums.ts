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
  SINGLE = 'single', // partido único (fase de grupos)
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

/**
 * Plataformas con identidad verificable y cuyo ID devuelve ballchasing en los
 * replays (Steam → SteamID64, Epic → Epic Account ID). Son el ancla para
 * resolver `replay → jugador → equipo` en el tracking de stats.
 */
export enum LinkedPlatform {
  STEAM = 'steam',
  EPIC = 'epic',
}

/**
 * Estado de un `.replay` subido: en proceso de parseo/match, importado a las
 * stats, a la espera de revisión manual (algo no se pudo resolver con
 * confianza) o fallido.
 */
export enum ReplayStatus {
  PROCESSING = 'processing',
  IMPORTED = 'imported',
  NEEDS_REVIEW = 'needs_review',
  FAILED = 'failed',
}

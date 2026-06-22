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
  BRONZE1 = 'bronze1',
  BRONZE2 = 'bronze2',
  BRONZE3 = 'bronze3',
  SILVER1 = 'silver1',
  SILVER2 = 'silver2',
  SILVER3 = 'silver3',
  GOLD1 = 'gold1',
  GOLD2 = 'gold2',
  GOLD3 = 'gold3',
  PLAT1 = 'plat1',
  PLAT2 = 'plat2',
  PLAT3 = 'plat3',
  PLAT4 = 'plat4',
  DIA1 = 'dia1',
  DIA2 = 'dia2',
  DIA3 = 'dia3',
  CHAMP1 = 'champ1',
  CHAMP2 = 'champ2',
  CHAMP3 = 'champ3',
  GC1 = 'gc1',
  GC2 = 'gc2',
  GC3 = 'gc3',
  // Supersonic Legend: rango tope (sin divisiones).
  SSL = 'ssl',
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
  PSN = 'psn',
  XBOX = 'xbox',
  SWITCH = 'switch',
}

/**
 * Plataformas que se verifican por OAuth/OpenID (ID criptográficamente seguro).
 * Las demás (consolas) usan el ID/online-ID que el jugador declara: no hay login
 * verificable de Sony/Microsoft/Nintendo, pero ese ID es el que aparece en el
 * replay, así que sirve igual para cruzar las stats.
 */
export const VERIFIED_PLATFORMS = [LinkedPlatform.STEAM, LinkedPlatform.EPIC];
export const isVerifiedPlatform = (p: LinkedPlatform) =>
  VERIFIED_PLATFORMS.includes(p);

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

/**
 * Tipo de anuncio en el tablón de reclutamiento (LFT / mercado de fichajes):
 *  - PLAYER_LFT: un jugador libre se publica buscando equipo.
 *  - TEAM_LFP: un equipo (inscrito o en formación) publica que busca jugador.
 */
export enum RecruitmentType {
  PLAYER_LFT = 'player_lft',
  TEAM_LFP = 'team_lfp',
}

/** Estado de un anuncio del tablón. HIDDEN lo aplica un admin al moderar. */
export enum RecruitmentStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  HIDDEN = 'hidden',
}

/** Posición preferida del jugador en cancha. */
export enum PlayerPosition {
  STRIKER = 'striker',
  GOALIE = 'goalie',
  FLEX = 'flex',
}

/**
 * Dirección de una solicitud de unión:
 *  - PLAYER_TO_TEAM: el jugador se postula y el capitán resuelve.
 *  - TEAM_TO_PLAYER: el capitán invita y el jugador resuelve.
 */
export enum JoinDirection {
  PLAYER_TO_TEAM = 'player_to_team',
  TEAM_TO_PLAYER = 'team_to_player',
}

/** Estado de una solicitud (unión, salida o invitación a formar equipo). */
export enum RequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Estado de un equipo en formación (`team_draft`): mientras junta gente
 * (PENDING), una vez completados los titulares y creado el equipo (COMPLETED),
 * o si el capitán lo cancela antes de completarse (CANCELLED).
 */
export enum TeamDraftStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/** Tipo de notificación in-app (campana). */
export enum NotificationType {
  TEAM_INVITE = 'team_invite', // un equipo inscrito te invitó
  DRAFT_INVITE = 'draft_invite', // te invitaron a formar un equipo nuevo
  APPLICATION = 'application', // un jugador se postuló a tu equipo (capitán)
  REQUEST_ACCEPTED = 'request_accepted',
  REQUEST_REJECTED = 'request_rejected',
  TEAM_CREATED = 'team_created', // el equipo en formación se completó
  LEAVE_REQUEST = 'leave_request', // pedido de salida (capitán)
  MEMBER_LEFT = 'member_left',
}

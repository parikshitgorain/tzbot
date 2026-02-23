/**
 * @file models.ts
 * @description Data model type definitions
 * @module types
 */
export var ViolationType;
(function (ViolationType) {
    ViolationType["SPAM"] = "spam";
    ViolationType["MALICIOUS_LINK"] = "malicious_link";
    ViolationType["UNAUTHORIZED_POST"] = "unauthorized_post";
    ViolationType["OTHER"] = "other";
})(ViolationType || (ViolationType = {}));
export var PunishmentLevel;
(function (PunishmentLevel) {
    PunishmentLevel["WARNING"] = "warning";
    PunishmentLevel["TIMEOUT_1H"] = "timeout_1h";
    PunishmentLevel["TIMEOUT_2H"] = "timeout_2h";
    PunishmentLevel["TIMEOUT_4H"] = "timeout_4h";
    PunishmentLevel["TIMEOUT_8H"] = "timeout_8h";
    PunishmentLevel["TIMEOUT_16H"] = "timeout_16h";
    PunishmentLevel["TIMEOUT_24H"] = "timeout_24h";
    PunishmentLevel["BAN"] = "ban";
})(PunishmentLevel || (PunishmentLevel = {}));
/**
 * Punishment type for progressive spam punishment system
 */
export var PunishmentType;
(function (PunishmentType) {
    PunishmentType["WARNING"] = "WARNING";
    PunishmentType["TIMEOUT"] = "TIMEOUT";
    PunishmentType["PERMANENT_BAN"] = "PERMANENT_BAN";
})(PunishmentType || (PunishmentType = {}));
export var GiveawayStatus;
(function (GiveawayStatus) {
    GiveawayStatus["ACTIVE"] = "active";
    GiveawayStatus["ENDED"] = "ended";
    GiveawayStatus["CANCELLED"] = "cancelled";
})(GiveawayStatus || (GiveawayStatus = {}));
export var EventType;
(function (EventType) {
    EventType["STREAM_LIVE"] = "stream_live";
    EventType["STREAM_OFFLINE"] = "stream_offline";
    EventType["NEW_SUBSCRIBER"] = "new_subscriber";
    EventType["NEW_VIP"] = "new_vip";
    EventType["RAID"] = "raid";
    EventType["HOST"] = "host";
    EventType["SPAM_DETECTED"] = "spam_detected";
    EventType["MALICIOUS_LINK_DETECTED"] = "malicious_link_detected";
})(EventType || (EventType = {}));
/**
 * Winner status for giveaway winner confirmation system
 */
export var WinnerStatus;
(function (WinnerStatus) {
    WinnerStatus["PENDING"] = "PENDING";
    WinnerStatus["CONFIRMED"] = "CONFIRMED";
    WinnerStatus["REROLLED"] = "REROLLED";
})(WinnerStatus || (WinnerStatus = {}));
//# sourceMappingURL=models.js.map
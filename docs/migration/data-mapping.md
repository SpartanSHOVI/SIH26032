# Data mapping

Preserve all four original Flyway migrations byte-for-byte as ordered Prisma migration SQL. Existing installations must baseline those four migrations after schema verification; never apply them to populated tables. Additive migration owns authentication sessions, audit, outbox and concurrency fields. Legacy Flyway history remains untouched. New API owns subsequent migrations after cutover.

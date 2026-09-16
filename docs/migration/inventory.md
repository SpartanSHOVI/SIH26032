# Migration inventory

GSD bypass explicitly authorized by the user. Legacy source is retained.

Active: farmers, centers, slots, tokens, notifications, message_logs, center_announcements, daily_demand. Legacy V1 booking/queue/lot/payment tables retained for compatibility, not authoritative for the active token workflow.

Implemented legacy flows: farmer/center/admin portals, booking, queue, stages, grace, location discovery, USSD and IVR handlers. Simulated: authentication, external notifications, government integrations. Placeholder: dedicated procurement/payment controllers; macro analytics contains synthetic fallbacks and rebalancing only returns a success message.

Migration status: implementation in progress; no live cutover authorized.

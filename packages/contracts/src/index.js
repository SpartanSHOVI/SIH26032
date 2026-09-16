const { z } = require('zod');
exports.queueEventSchema=z.object({version:z.literal(1),eventId:z.string().uuid(),type:z.string(),centerId:z.string().uuid(),farmerId:z.string().uuid().optional(),tokenNumber:z.string().optional(),status:z.string().optional(),timestamp:z.string().datetime()});

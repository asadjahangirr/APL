import { z } from 'zod';
export const contactInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254).transform(v => v.trim().toLowerCase()),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(200).default('')
}).strict();


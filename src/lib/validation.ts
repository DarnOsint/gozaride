import { z } from "zod";

export const SERVICE_TYPES = ["taxi", "motorcycle", "package", "food", "rental", "bus"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
  full_name: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .regex(/^\+?[0-9 ()-]+$/, "Phone may contain digits, spaces, + and brackets only")
    .optional(),
  // Admins cannot self-register. An existing admin must create them.
  role: z.enum(["customer", "driver", "shop"]),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export const tripRequestSchema = z.object({
  service_type: z.enum(SERVICE_TYPES),
  origin: z.object({ lat, lng, name: z.string().trim().max(200).optional() }),
  destination: z.object({ lat, lng, name: z.string().trim().max(200).optional() }),
});

export const locationSchema = z.object({
  latitude: lat,
  longitude: lng,
});

export const availabilitySchema = z.object({
  is_online: z.boolean(),
  vehicle_type: z.string().trim().max(50).optional(),
  plate_number: z.string().trim().max(20).optional(),
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const ratingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const rateSchema = z.object({
  ssp_per_usd: z.number().positive().max(1_000_000),
  note: z.string().trim().max(300).optional(),
});

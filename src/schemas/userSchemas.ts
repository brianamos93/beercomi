import { z } from "zod";

export const LoginSchema = z.object({
	email: z.email(),
	password: z.string().min(8, { message: "Password is at least 8 characters long."})
})

export const SignupSchema = LoginSchema.extend({
	display_name: z.string().min(5, {message: "Display name must be at least 5 characters long."})
})

export const RoleInputSchema = z.object({
	role: z.enum(["admin", "basic"])
})

const multerFileSchema = z
	.object({
		fieldname: z.string(),
		originalname: z.string(),
		encoding: z.string(),
		mimetype: z.string(),
		size: z.number(),
		buffer: z.instanceof(Buffer),
	})
	.refine(
		(file) => ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
		{ message: "Only JPEG, PNG, or WEBP images are allowed." }
	)
	// Limit file size to 1MB
	.refine((file) => file.size <= 1_000_000, {
		message: "File must be less than 1MB.",
	});

export const profileImageSchema = z.object({
	image: multerFileSchema,
})

export const PasswordChangeSchema = LoginSchema.omit({
	email: true
})
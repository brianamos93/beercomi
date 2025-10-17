import { z } from "zod";

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

const existingFileSchemaForEdit = z.object({
  id: z.string(),
  url: z.string().url(),
  type: z.literal("existing"),
  markedForDelete: z.boolean().optional(),
});

export const CreateReviewSchema = z.object({
  review: z
    .string()
    .trim()
    .min(10, { message: "Review must be at least 10 character long." }),
  rating: z.coerce.number(),
  beer_id: z.string(),
  photos: z.array(multerFileSchema).max(4, "You can upload up to 4 files.").optional().nullable()
});

export const EditReviewSchema = CreateReviewSchema.extend({
	kept: z.array(z.string()),
	deleted: z.array(z.string())
})

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export type ExistingFile = z.infer<typeof existingFileSchemaForEdit>;
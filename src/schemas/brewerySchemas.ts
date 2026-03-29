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

export const BrewerySchemaBase = z.object({
	name: z
		.string()
		.trim()
		.min(1, { message: "Brewery name must be at least 1 character long." })
		.trim(),
	location: z
		.string()
		.trim()
		.min(1, {
			message: "Brewery location must be at least 5 characters long.",
		}),
	date_of_founding: z
		.string()
		.trim()
		.min(4, {
			message: "The date of founding must be at least 4 character long.",
		}),
});

const allowedStringValues = ['true', 'false'] as const;

export type BeerInput = z.infer<typeof BrewerySchemaBase>;

export const EditBrewerySchema = BrewerySchemaBase.extend({
	deleteCoverImage: z.enum(allowedStringValues),
});

export type EditBeerInput = z.infer<typeof EditBrewerySchema>;

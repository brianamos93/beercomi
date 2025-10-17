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

export const BeerSchemaBase = z.object({
	name: z.string().trim().min(1, "Name is required."),
	style: z.string().trim().min(1, "Style is required."),
	abv: z.coerce.number().min(0, "ABV must be a positive number."),
	brewery_id: z.string().min(1, "A brewery is required."),
	color: z.string().min(1, "Color is required."),
	ibu: z.coerce.number().min(0, "IBU must be a positive number."),
	description: z.string().min(1, "Description is required."),
	cover_image: multerFileSchema,
});

export const EditBeerSchema = BeerSchemaBase.extend({
	deleteCoverImage: z.boolean(),
});

export type EditBeerInput = z.infer<typeof EditBeerSchema>;

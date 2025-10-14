import { z } from "zod"

const MAX_FILE_SIZE = 1000000;
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

export const newCoverImageSchema = z
	.instanceof(File)
	.refine((f) => f.size <= MAX_FILE_SIZE, "Max file size is 1MB.")
	.refine(
		(f) => ACCEPTED_IMAGE_TYPES.includes(f.type),
		"Only JPG, JPEG, PNG, WEBP are allowed."
	).nullable().optional()

const existingCoverImageSchema = z.object({
	url: z.string(),
	type: z.literal("existing"),
})

const newEditCoverImageSchema = z.object({
	file: newCoverImageSchema,
	preview: z.string(),
	type: z.literal("new")

})


export const CreateBeerSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required."),
	style: z
		.string()
		.trim()
		.min(1, "Style is required."),
	abv: z.coerce.number().min(0, "ABV must be a positive number."),
	brewery_id: z
		.string()
		.min(1, "A brewery is required."),
	color: z
		.string()
		.min(1, "Color is required."),
	ibu: z.coerce.number().min(0, "IBU must be a positive number."),
	description: z
		.string()
		.min(1, "Description is required."),
	cover_image: newCoverImageSchema
		
})

export const EditBeerSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required."),
	style: z
		.string()
		.trim()
		.min(1, "Style is required."),
	abv: z.coerce.number().min(0, "ABV must be a positive number."),
	brewery_id: z
		.string()
		.min(1, "A brewery is required."),
	color: z
		.string()
		.min(1, "Color is required."),
	ibu: z.coerce.number().min(0, "IBU must be a positive number."),
	description: z
		.string()
		.min(1, "Description is required."),
	cover_image: newCoverImageSchema.nullable().optional(),
	deleteCoverImage: z.boolean()
		
})

export type EditBeerInput = z.infer<typeof EditBeerSchema>;

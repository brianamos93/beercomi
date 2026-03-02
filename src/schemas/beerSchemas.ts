import { z } from "zod";

export const BeerSchemaBase = z.object({
	name: z.string().trim().min(1, "Name is required."),
	style: z.string().trim().min(1, "Style is required."),
	abv: z.coerce.number().min(0, "ABV must be a positive number."),
	brewery_id: z.string().min(1, "A brewery is required."),
	color: z.string().min(1, "Color is required."),
	ibu: z.coerce.number().min(0, "IBU must be a positive number."),
	description: z.string().min(1, "Description is required."),
});

export const EditBeerSchema = BeerSchemaBase.extend({
	deleteCoverImage: z.coerce.boolean(),
});

export type EditBeerInput = z.infer<typeof EditBeerSchema>;

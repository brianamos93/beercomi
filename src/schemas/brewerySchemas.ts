import { z } from "zod";

export const BrewerySchemaBase = z.object({
	name: z
		.string()
		.trim()
		.min(1, { message: "Brewery name must be at least 1 character long." }),
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
	deleteCoverImage: z.enum(allowedStringValues).transform(val => val === 'true'),
});

export type EditBreweryInput = z.infer<typeof EditBrewerySchema>;

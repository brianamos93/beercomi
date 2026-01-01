import { z } from "zod";

export const favoriteInputSchema = z.object({
	target_id: z.uuidv4(),
	table: z.enum(["beers", "breweries"]),
})

export const favoriteDeleteSchema = z.object({
	table: z.enum(["beers", "breweries"]),
	id: z.uuidv4(),
})

export const favoriteGetTableSchema = z.object({
	table: z.enum(["beers", "breweries", "all"]),
	user_id: z.uuidv4(),
})

export const favoriteIdSchema = z.object({
	table: z.enum(["beers", "breweries"]),
	id: z.uuidv4(),
})
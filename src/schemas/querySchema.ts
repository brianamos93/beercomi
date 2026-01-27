import z from "zod";

export const querySchema = z.object({
	limit: z.coerce.number()
		.optional()
		.transform((val) => (val ? Number(val) : 10))
		.refine((val) => val > 0 && val <= 100, {
			message: "Limit must be between 1 and 100",
		}),
	offset: z
		.coerce.number()
		.optional()
		.transform((val) => (val ? Number(val) : 0))
		.refine((val) => val >= 0, {
			message: "Offset must be greater than or equal to 0",
		}),
});

export const searchQuerySchema = querySchema.extend({
	q: z.string()
});

export type SearchQueryType = z.infer<typeof searchQuerySchema>

export type QueryType = z.infer<typeof querySchema>;

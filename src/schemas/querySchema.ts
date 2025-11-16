import z from "zod";

export const querySchema = z.object({
	limit: z
		.union([z.string(), z.number()])
		.optional()
		.transform((val) => (val ? Number(val) : 10))
		.refine((val) => val > 0 && val <= 100, {
			message: "Limit must be between 1 and 100",
		}),
	offset: z
		.union([z.string(), z.number()])
		.optional()
		.transform((val) => (val ? Number(val) : 0))
		.refine((val) => val >= 0, {
			message: "Offset must be greater than or equal to 0",
		}),
});

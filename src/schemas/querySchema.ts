import z from "zod";

export const querySchema = z.object({
	limit: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val, 10) : 10))
		.refine((val) => val > 0 && val <= 100, {
			message: "Limit must be between 1 and 100",
		}),
	offset: z
		.string()
		.optional()
		.transform((val) => (val ? parseInt(val, 10) : 0))
		.refine((val) => val >= 0, {
			message: "Offset must be greater than or equal to 0",
		}),
});

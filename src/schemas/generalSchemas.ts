import z from "zod";

export const idParamSchema = z.object({
	id: z.uuidv4()
})

export type IdParam = z.infer<typeof idParamSchema>;
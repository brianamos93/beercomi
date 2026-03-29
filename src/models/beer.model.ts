import pool from "../utils/config";

export const BeerModel = {
	async nullCoverImage(beerId: string) {
		const query = `
		UPDATE beers 
		SET cover_image = NULL 
		WHERE id = $1
		`;
		const result = await pool.query(query, [beerId]);
		return result;
	},
}
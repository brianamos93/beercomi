import { Brewery } from "../defs/brewery.defs";
import pool from "../utils/config";

export const BreweryModel = {
	async getBrewery(breweryId: string) {
		const query = `
			SELECT 
				id, 
				name, 
				location, 
				date_of_founding, 
				author_id 
				FROM breweries 
				WHERE id = $1 
					AND deleted_at IS NULL`;
		const result = await pool.query(query, [breweryId]);
		return result;
	},
	async softDeletedBreweryLookup(breweryId: string) {
		const query = `
			SELECT 
				id, 
				name, 
				location, 
				date_of_founding, 
				author_id 
				FROM breweries 
				WHERE id = $1 
					AND deleted_at IS NOT NULL
		`;
		const result = await pool.query(query, [breweryId]);
		return result.rows[0];
	},
	async breweryAuthor(breweryId: string) {
		const query = `
		SELECT 
			author_id 
			FROM breweries 
			WHERE id = $1
		`;
		const result = await pool.query(query, [breweryId]);
		return result.rows[0];
	},
	async getBreweryCoverImage(breweryId: string) {
		const query = `
		SELECT 
		cover_image 
		FROM breweries 
		WHERE id = $1
		`;
		const result = await pool.query(query, [breweryId]);
		return result.rows[0];
	},
	async getBrewerySearch({
		query,
		limit,
		offset,
	}: {
		query?: string | undefined | null;
		limit: number;
		offset: number;
	}) {
		const filters: string[] = ["breweries.deleted_at IS NULL"];
		const filterParams: any[] = [];

		if (query) {
			filterParams.push(query);
			const paramIndex = filterParams.length;

			filters.push(`
          (
            breweries.name ILIKE $${paramIndex}
            OR breweries.location ILIKE $${paramIndex}
            OR breweries.date_of_founding::TEXT ILIKE $${paramIndex}
            OR breweries.date_created::TEXT ILIKE $${paramIndex}
            OR breweries.date_updated::TEXT ILIKE $${paramIndex}
          )
        `);
		}
		const whereClause = `WHERE ${filters.join(" AND ")}`;

		const mainParams = [...filterParams];

		mainParams.push(limit);
		const limitParamIndex = mainParams.length;

		mainParams.push(offset);
		const offsetParamIndex = mainParams.length;

		const mainQuery = `
			SELECT 
				breweries.id, 
				breweries.name, 
				breweries.location, 
				breweries.date_of_founding,
				breweries.cover_image, 
				breweries.date_created, 
				breweries.date_updated, 
				breweries.author_id, 
				brewery_authors.display_name AS author_name 
			FROM breweries 
			LEFT JOIN users AS brewery_authors 
			ON breweries.author_id = brewery_authors.id 
			${whereClause}
			ORDER BY breweries.date_updated DESC
			LIMIT $${limitParamIndex}
			OFFSET $${offsetParamIndex}
			`;

		const countQuery = `
			SELECT COUNT(*) 
			FROM breweries
			${whereClause}
      	`;

		const [breweriesResult, countResult] = await Promise.all([
			pool.query(mainQuery, mainParams),
			pool.query(countQuery, filterParams),
		]);

		const breweries: Brewery[] = breweriesResult.rows;
		const totalItems = parseInt(countResult.rows[0].count, 10);

		return {
			pagination: {
				total: totalItems,
				limit,
				offset,
			},
			data: breweries,
		};
	},
	async getAllBreweriesList() {
		const query = `
			SELECT 
			id 
			FROM 
			breweries 
			WHERE deleted_at IS NULL
			`;
		const result = await pool.query(query);
		return result;
	},
	async getBreweryBeers({
		id,
		limit,
		offset,
	}: {
		id: string;
		limit: number;
		offset: number;
	}) {
		const beerQuery = `
		SELECT 
			beers.id,
			beers.name,
			beers.style,
			beers.ibu,
			beers.abv / 10.0 AS abv,
			beers.color,
			beers.description,
			beers.cover_image,
			beers.date_created,
			beers.date_updated,
			beers.author_id,
			beer_authors.display_name AS author_name
		FROM beers
		LEFT JOIN users AS beer_authors ON beers.author_id = beer_authors.id
		WHERE beers.brewery_id = $1 AND beers.deleted_at IS NULL
		ORDER BY beers.date_created DESC
		LIMIT $2 OFFSET $3
		`;
		const countQuery = `
		SELECT COUNT(*) 
		FROM beers 
		WHERE brewery_id = $1 
			AND deleted_at IS NULL`;
		const [beersResult, countResults] = await Promise.all([
			pool.query(beerQuery, [id, limit, offset]),
			pool.query(countQuery, [id]),
		]);

		const totalBeers = Number(countResults.rows[0].count);

		return {
			beers: beersResult.rows,
			pagination: {
				total: totalBeers,
				limit,
				offset,
			},
		};
	},
	async getBreweryDetailed(breweryId: string) {
		const query = `
		SELECT 
			breweries.id, 
			breweries.name, 
			breweries.location, 
			breweries.date_of_founding,
			breweries.cover_image, 
			breweries.date_created, 
			breweries.date_updated, 
			brewery_authors.display_name AS author_name,
			breweries.author_id
		FROM breweries
		LEFT JOIN users AS brewery_authors 
			ON breweries.author_id = brewery_authors.id
		WHERE breweries.id = $1 AND breweries.deleted_at IS NULL
		`;
		const result = await pool.query(query, [breweryId]);
		return result.rows[0];
	},
	async postBrewery({
		name,
		location,
		date_of_founding,
		filePath,
	}: {
		name: string;
		location: string;
		date_of_founding: string;
		filePath: string | null;
	}) {
		const query = `
		INSERT INTO breweries 
			(name, 
			location, 
			date_of_founding, 
			author_id, 
			cover_image) 
			VALUES ($1, $2, $3, $4, $5) 
			RETURNING *
		`;
		const result = await pool.query(query, [
			name,
			location,
			date_of_founding,
			filePath,
		]);
		return result.rows[0]
	},
};

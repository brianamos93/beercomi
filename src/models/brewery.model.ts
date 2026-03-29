import path from "path";
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
		return result.rows;
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
			...beersResult.rows,
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
		return result.rows[0];
	},
	async updateBrewery({
		name,
		location,
		date_of_founding,
		relativeUploadFilePathAndFile,
		breweryID,
	}: {
		name: string;
		location: string;
		date_of_founding: string;
		relativeUploadFilePathAndFile: string;
		breweryID: string;
	}) {
		const query = `
		UPDATE breweries 
		SET 
			name = $1, 
			location = $2, 
			date_of_founding = $3, 
			cover_image = $4 
			WHERE id = $5
		`;
		const result = await pool.query(query, [
			name,
			location,
			date_of_founding,
			relativeUploadFilePathAndFile,
			breweryID,
		]);

		return result.rows[0];
	},
	async nullCoverImage(breweryId: string) {
		const query = `
		UPDATE breweries 
		SET cover_image = NULL 
		WHERE id = $1
		`;
		const result = await pool.query(query, [breweryId]);
		return result;
	},
	async softDeleteBreweryCascade(breweryID: string) {
		const client = await pool.connect();
		const deletedAt = new Date();

		try {
			await client.query("BEGIN");

			// delete reviews
			await client.query(
				`UPDATE beer_reviews r
				SET deleted_at = $2
				FROM beers b
				WHERE r.beer_id = b.id
				AND b.brewery_id = $1
				AND r.deleted_at IS NULL`,
				[breweryID, deletedAt],
			);

			// delete beers
			await client.query(
				`UPDATE beers
				SET deleted_at = $2
				WHERE brewery_id = $1
				AND deleted_at IS NULL`,
				[breweryID, deletedAt],
			);

			// delete brewery
			const result = await client.query(
				`UPDATE breweries
				SET deleted_at = $2
				WHERE id = $1
				AND deleted_at IS NULL
				RETURNING id`,
				[breweryID, deletedAt],
			);

			await client.query("COMMIT");

			return result;
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	},
	async getDeletedBreweryById(breweryId: string) {
		return pool.query(
			`SELECT 
            breweries.id, 
            breweries.name, 
            breweries.location, 
            breweries.date_of_founding,
            breweries.cover_image, 
            breweries.date_created, 
            breweries.date_updated,
            breweries.deleted_at,
            brewery_authors.display_name AS author_name,
            breweries.author_id
        FROM breweries
        LEFT JOIN users AS brewery_authors 
            ON breweries.author_id = brewery_authors.id
        WHERE breweries.id = $1 
        AND breweries.deleted_at IS NOT NULL`,
			[breweryId],
		);
	},
	async getBeersByBreweryId(breweryId: string, limit: number, offset: number) {
		return pool.query(
			`SELECT 
            beers.id,
            beers.name,
            beers.style,
            beers.ibu,
            beers.abv,
            beers.color,
            beers.description,
            beers.cover_image,
            beers.date_created,
            beers.date_updated,
            beers.author_id,
            beer_authors.display_name AS author_name
        FROM beers
        LEFT JOIN users AS beer_authors 
            ON beers.author_id = beer_authors.id
        WHERE beers.brewery_id = $1
        ORDER BY beers.date_created DESC
        LIMIT $2 OFFSET $3`,
			[breweryId, limit, offset],
		);
	},
	async countBeersByBreweryId(breweryId: string) {
		return pool.query(`SELECT COUNT(*) FROM beers WHERE brewery_id = $1`, [
			breweryId,
		]);
	},
	async undoSoftDeleteTransaction(breweryID: string) {
		const client = await pool.connect();

		try {
			await client.query("BEGIN");

			// Get deleted_at timestamp
			const breweryResult = await client.query(
				`SELECT deleted_at FROM breweries WHERE id = $1`,
				[breweryID],
			);

			if (breweryResult.rowCount === 0) {
				throw new Error("NO_BREWERY");
			}

			const deletedAt = breweryResult.rows[0].deleted_at;

			// Restore reviews
			await client.query(
				`UPDATE beer_reviews r
			 SET deleted_at = NULL
			 FROM beers b
			 WHERE r.beer_id = b.id
			 AND b.brewery_id = $1
			 AND r.deleted_at = $2`,
				[breweryID, deletedAt],
			);

			// Restore beers
			await client.query(
				`UPDATE beers
			 SET deleted_at = NULL
			 WHERE brewery_id = $1
			 AND deleted_at = $2`,
				[breweryID, deletedAt],
			);

			// Restore brewery
			await client.query(
				`UPDATE breweries
			 SET deleted_at = NULL
			 WHERE id = $1`,
				[breweryID],
			);

			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	},
	async hardDeleteBrewery(breweryID: string) {
		const client = await pool.connect();
		const filesToDelete: string[] = [];

		try {
			await client.query("BEGIN");

			// brewery
			const breweryData = await BreweryModel.getBrewery(breweryID);

			if (breweryData.rowCount === 0) {
				await client.query("ROLLBACK");
				return { notFound: true, filesToDelete: [] };
			}

			if (breweryData.rows[0].cover_image) {
				filesToDelete.push(
					path.join(__dirname, "..", breweryData.rows[0].cover_image),
				);
			}

			// beers
			const beerImages = await client.query(
				`SELECT cover_image FROM beers WHERE brewery_id = $1`,
				[breweryID],
			);

			for (const beer of beerImages.rows) {
				if (beer.cover_image) {
					filesToDelete.push(path.join(__dirname, "..", beer.cover_image));
				}
			}

			// review photos
			const reviewPhotos = await client.query(
				`
				SELECT rp.photo_url
				FROM review_photos rp
				INNER JOIN beer_reviews br ON rp.review_id = br.id
				INNER JOIN beers b ON br.beer_id = b.id
				WHERE b.brewery_id = $1
				`,
				[breweryID],
			);

			for (const photo of reviewPhotos.rows) {
				if (photo.photo_url) {
					filesToDelete.push(path.join(__dirname, "..", photo.photo_url));
				}
			}

			// deletes (order matters)
			await client.query(
				`DELETE FROM review_photos
				WHERE review_id IN (
					SELECT id FROM beer_reviews
					WHERE beer_id IN (
						SELECT id FROM beers WHERE brewery_id = $1
					)
				)`,
				[breweryID],
			);

			await client.query(
				`DELETE FROM beer_reviews
				WHERE beer_id IN (
					SELECT id FROM beers WHERE brewery_id = $1
				)`,
				[breweryID],
			);

			await client.query(`DELETE FROM beers WHERE brewery_id = $1`, [
				breweryID,
			]);

			await client.query(`DELETE FROM breweries WHERE id = $1`, [breweryID]);

			await client.query("COMMIT");

			return { filesToDelete, notFound: false };
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	},
};

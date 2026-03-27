import pool from "../utils/config";

export const UserModel = {
	async getTablesWithActivityColumns(): Promise<string[]> {
		const query = `
			SELECT table_name
			FROM information_schema.columns
			WHERE table_schema = 'public'
			AND column_name IN ('date_updated', 'author_id')
			GROUP BY table_name
			HAVING COUNT(DISTINCT column_name) = 2;
		`;

		const res = await pool.query(query);
		return res.rows.map((row) => row.table_name);
	},

	async getRecentActivityFromTables(tables: string[], userId: string) {
		if (tables.length === 0) return [];

		const safeTables = tables.filter((t) =>
			["beers", "breweries", "reviews"].includes(t),
		);

		const queries = safeTables.map(
			(table, i) => `
				SELECT 
					$${i + 2} AS table_name,
					${table}.id::TEXT AS id,
					${table}.date_updated::TIMESTAMP AS date_updated
				FROM ${table}
				WHERE author_id = $1
			`,
		);

		const sql = `
			SELECT * FROM (
				${queries.join(" UNION ALL ")}
			) AS combined
			ORDER BY date_updated DESC
			LIMIT 10
		`;

		const values = [userId, ...safeTables];

		const result = await pool.query(sql, values);
		return result.rows;
	},
	async getTokenUser(token: any) {
		const query = `
		SELECT 
			id, 
			role, 
			display_name, 
			profile_img_url, 
			present_location 
			FROM users 
			WHERE id = $1
		`;
		const result = await pool.query(query, [token.id]);
		return result.rows[0];
	},
	async emailCheck(email: string) {
		const query = `
		SELECT 
		id 
		FROM users 
		WHERE email = $1`;

		const result = await pool.query(query, [email]);
		return result;
	},
	async displayNameCheck(display_name: string) {
		const query = `
		SELECT 
		id 
		FROM users 
		WHERE display_name = $1
		`;
		const result = await pool.query(query, [display_name]);
		return result;
	},
	async signup({
		email,
		passwordHash,
		display_name,
	}: {
		email: string;
		passwordHash: string;
		display_name: string;
	}) {
		const query = `
		INSERT INTO users(email, password, display_name) VALUES($1, $2, $3) RETURNING *
		`;
		const result = await pool.query(query, [email, passwordHash, display_name]);
		return result.rows[0];
	},
	async removeAvatar(userId: string) {
		const query = `
		UPDATE users
		SET profile_img_url = null
		WHERE id = $1
		RETURNING *;
		`
		const results = await pool.query(query, [userId])
		return results.rows[0]
	}, 
	async uploadAvatar({filepath, userId}: { filepath: string, userId: string}) {
		const query = `
		UPDATE users
		SET profile_img_url = $1
		WHERE id = $2
		RETURNING *;
		`
		const results = await pool.query(query, [filepath, userId])
		return results.rows[0]
	},
	async getUser(userId: string) {
		const query = `
			SELECT 
				users.id, 
				users.display_name, 
				users.profile_img_url, 
				users.present_location, 
				users.introduction, 
				users.role 
				FROM users 
				WHERE users.id = $1 
		`
		const result = await pool.query(query, [userId])
		return result.rows[0]
	},
	async deleteUser (userId: string) {
		const query = `
		DELETE FROM users WHERE id = $1
		`
		const result = await pool.query(query, [userId])

		return result
	},
	async changePassword({password, userId}: {password: string, userId: string}) {
		const query = `
		UPDATE users SET password = $1 WHERE id = $2
		`
		const result = pool.query(query, [password, userId])
		return result
	},
	async updateUserRole({role, userId}: {role: string, userId: string}) {
		const query = `UPDATE users SET role = $1 WHERE id = $2`
		const result = pool.query(query, [role, userId])
		return result
	}
};

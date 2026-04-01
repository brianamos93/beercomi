SET search_path TO public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';
SET default_tablespace = '';
SET default_table_access_method = heap;
CREATE TABLE activity_log (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);
CREATE TABLE beer_reviews (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    author_id uuid,
    beer_id uuid,
    review text NOT NULL,
    rating smallint CHECK (
        rating BETWEEN 1 AND 5
    ) NOT NULL,
    date_created timestamp with time zone DEFAULT now(),
    date_updated timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);
CREATE TABLE beers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    brewery_id uuid,
    description text,
    ibu integer,
    abv numeric,
    color text,
    author_id uuid,
    style text,
    date_created timestamp with time zone DEFAULT now(),
    date_updated timestamp with time zone DEFAULT now(),
    cover_image character varying(255),
    deleted_at timestamp with time zone
);
CREATE TABLE beers_favorites (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    beer_id uuid NOT NULL,
    date_created timestamp with time zone DEFAULT now()
);
CREATE TABLE breweries (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    location text NOT NULL,
    date_of_founding text NOT NULL,
    date_created timestamp with time zone DEFAULT now(),
    date_updated timestamp with time zone DEFAULT now(),
    author_id uuid,
    cover_image character varying(255),
    deleted_at timestamp with time zone
);
CREATE TABLE breweries_favorites (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    brewery_id uuid NOT NULL,
    date_created timestamp with time zone DEFAULT now()
);
CREATE TABLE review_photos (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    review_id uuid NOT NULL,
    date_created timestamp with time zone DEFAULT now(),
    date_updated timestamp with time zone DEFAULT now(),
    photo_url text,
    "position" integer,
    deleted_at timestamp with time zone
);
CREATE TABLE users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'basic'::text NOT NULL,
    display_name character varying(16) DEFAULT 'Guest'::character varying NOT NULL,
    profile_img_url character varying(255),
    present_location character varying(70),
    introduction character varying(160),
    CONSTRAINT users_role_check CHECK (
        (role = ANY (ARRAY ['basic'::text, 'admin'::text]))
    )
);
ALTER TABLE ONLY activity_log
ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY beer_reviews
ADD CONSTRAINT beer_reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY beers_favorites
ADD CONSTRAINT beers_favorites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY beers
ADD CONSTRAINT beers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY breweries_favorites
ADD CONSTRAINT breweries_favorites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY breweries
ADD CONSTRAINT breweries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY review_photos
ADD CONSTRAINT review_photos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY beers_favorites
ADD CONSTRAINT unique_user_beer UNIQUE (user_id, beer_id);
ALTER TABLE ONLY breweries_favorites
ADD CONSTRAINT unique_user_brewery UNIQUE (user_id, brewery_id);
ALTER TABLE ONLY users
ADD CONSTRAINT users_display_name_key UNIQUE (display_name);
ALTER TABLE ONLY users
ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY users
ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE TRIGGER trg_breweries_update_timestamp BEFORE
UPDATE ON breweries FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_beer_reviews_update_timestamp BEFORE
UPDATE ON beer_reviews FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_review_photos_update_timestamp BEFORE
UPDATE ON review_photos FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_beers_update_timestamp BEFORE
UPDATE ON beers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
ALTER TABLE ONLY beer_reviews
ADD CONSTRAINT fk_beer_reviews_author FOREIGN KEY (author_id) REFERENCES users(id);
ALTER TABLE ONLY beer_reviews
ADD CONSTRAINT fk_beer_reviews_beer FOREIGN KEY (beer_id) REFERENCES beers(id) ON DELETE CASCADE;
ALTER TABLE ONLY beers
ADD CONSTRAINT fk_beers_author FOREIGN KEY (author_id) REFERENCES users(id);
ALTER TABLE ONLY beers
ADD CONSTRAINT fk_beers_brewery FOREIGN KEY (brewery_id) REFERENCES breweries(id) ON DELETE CASCADE;
ALTER TABLE ONLY breweries
ADD CONSTRAINT fk_breweries_author FOREIGN KEY (author_id) REFERENCES users(id);
ALTER TABLE ONLY beers_favorites
ADD CONSTRAINT fk_beers_favorites_beer FOREIGN KEY (beer_id) REFERENCES beers(id) ON DELETE CASCADE;
ALTER TABLE ONLY breweries_favorites
ADD CONSTRAINT fk_breweries_favorites_brewery FOREIGN KEY (brewery_id) REFERENCES breweries(id) ON DELETE CASCADE;
ALTER TABLE ONLY review_photos
ADD CONSTRAINT fk_review_photos_review FOREIGN KEY (review_id) REFERENCES beer_reviews(id) ON DELETE CASCADE;
ALTER TABLE ONLY review_photos
ADD CONSTRAINT fk_review_photos_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY beers_favorites
ADD CONSTRAINT fk_beers_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY breweries_favorites
ADD CONSTRAINT fk_breweries_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY activity_log
ADD CONSTRAINT fk_activity_log_user FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE beer_reviews
ADD CONSTRAINT unique_user_beer_review UNIQUE (author_id, beer_id);
--
-- PostgreSQL database dump
--

\restrict 719iM938i4RX7irGmfEpB9HDx5Lm20icGPE7cmJ1pPfSn8TkpUDtEb9LP9YmeZm

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

-- Started on 2026-01-31 22:07:19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16603)
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- TOC entry 5064 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 225 (class 1259 OID 16496)
-- Name: additional_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.additional_files (
    id integer NOT NULL,
    battery integer NOT NULL,
    file_path character varying,
    filename character varying,
    notes text
);


ALTER TABLE public.additional_files OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16495)
-- Name: additional_files_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.additional_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.additional_files_id_seq OWNER TO postgres;

--
-- TOC entry 5065 (class 0 OID 0)
-- Dependencies: 224
-- Name: additional_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.additional_files_id_seq OWNED BY public.additional_files.id;


--
-- TOC entry 220 (class 1259 OID 16466)
-- Name: batteries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.batteries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.batteries_id_seq OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16467)
-- Name: batteries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.batteries (
    id integer DEFAULT nextval('public.batteries_id_seq'::regclass) NOT NULL,
    batch integer NOT NULL,
    cell_name character varying NOT NULL,
    manufacturer character varying NOT NULL,
    label character varying,
    capacity_nom real,
    capacity_max real,
    capacity_min real,
    voltage_nom real,
    voltage_max real,
    voltage_min real,
    energy real,
    recommended_soc_min character varying,
    recommended_soc_max character varying,
    chemistry_family character varying,
    cathode character varying,
    cathode_thikness real,
    cathode_electrode_material character varying,
    cathode_electrode_thikness real,
    separator_material character varying,
    separator_thikness real,
    anode character varying,
    anode_thikness real,
    anode_electrode_material character varying,
    anode_electrode_thikness real,
    dcir_1s_ohms_25c_50soc real,
    dcir_5s_ohms_25c_50soc real,
    dcir_10s_ohms_25c_50soc real,
    dcir_10s_ohm_ah real,
    dcir_10s_siemens real,
    dcir_10s_siemens_wh real,
    dcir_30s_ohms_25c_50soc real,
    dcir_30s_ohm_ah real,
    dcir_30s_siemens real,
    dcir_30s_siemens_wh real,
    dcir_continuous_ohms_25c_50soc real,
    acir_1khz real,
    start_of_production date,
    dim_w real,
    dim_l real,
    dim_h real,
    volume real,
    wall_thikness real,
    case_material character varying,
    dch_amps_max real,
    dch_amps_cont real,
    dch_c_rate_max character varying,
    dch_c_rate_cont character varying,
    dch_w_5s real,
    dch_w_10s real,
    dch_w_30s real,
    dch_w_cont real,
    dch_max_temp real,
    dch_min_temp real,
    ch_amps_max real,
    ch_amps_cont real,
    ch_c_rate_max real,
    ch_c_rate_cont real,
    ch_w_5s real,
    ch_w_10s real,
    ch_w_30s real,
    ch_w_cont real,
    ch_max_temp real,
    ch_min_temp real,
    fast_charge_time_10_to_80 real,
    self_dch_max_month character varying,
    calendar_ageing_soc character varying,
    calendar_ageing_temp real,
    calendar_ageing_days real,
    calendar_ageing_soh real,
    cycling_ageing_cycles_to_70soh integer,
    cycling_ageing_70_c_rate character varying,
    cycling_ageing_cycles_to_80soh integer,
    cycling_ageing_80_c_rate character varying,
    wh_kg real,
    wh_litre real,
    w_10s_kg real,
    w_cont_kg real,
    w_10s_litre real,
    applications text,
    cell_type character varying,
    created_by bigint DEFAULT 1 NOT NULL
);


ALTER TABLE public.batteries OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16480)
-- Name: experiments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.experiments (
    id integer NOT NULL,
    battery integer NOT NULL,
    table_path character varying,
    experiment_type character varying,
    notes text,
    created_by bigint DEFAULT 1 NOT NULL
);


ALTER TABLE public.experiments OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16479)
-- Name: experiments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.experiments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.experiments_id_seq OWNER TO postgres;

--
-- TOC entry 5066 (class 0 OID 0)
-- Dependencies: 222
-- Name: experiments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.experiments_id_seq OWNED BY public.experiments.id;


--
-- TOC entry 230 (class 1259 OID 16641)
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16558)
-- Name: updates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.updates (
    id bigint NOT NULL,
    table_name text NOT NULL,
    row_id integer,
    action text NOT NULL,
    user_id integer NOT NULL,
    update_date timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    CONSTRAINT updates_action_check CHECK ((action = ANY (ARRAY['add'::text, 'delete'::text, 'change'::text])))
);


ALTER TABLE public.updates OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16557)
-- Name: updates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.updates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.updates_id_seq OWNER TO postgres;

--
-- TOC entry 5067 (class 0 OID 0)
-- Dependencies: 226
-- Name: updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.updates_id_seq OWNED BY public.updates.id;


--
-- TOC entry 229 (class 1259 OID 16581)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    login text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'creator'::text NOT NULL,
    CONSTRAINT users_login_check CHECK ((length(login) >= 3)),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['creator'::text, 'editor'::text, 'admin'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16580)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5068 (class 0 OID 0)
-- Dependencies: 228
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4875 (class 2604 OID 16499)
-- Name: additional_files id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.additional_files ALTER COLUMN id SET DEFAULT nextval('public.additional_files_id_seq'::regclass);


--
-- TOC entry 4873 (class 2604 OID 16483)
-- Name: experiments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiments ALTER COLUMN id SET DEFAULT nextval('public.experiments_id_seq'::regclass);


--
-- TOC entry 4876 (class 2604 OID 16561)
-- Name: updates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.updates ALTER COLUMN id SET DEFAULT nextval('public.updates_id_seq'::regclass);


--
-- TOC entry 4878 (class 2604 OID 16584)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4893 (class 2606 OID 16505)
-- Name: additional_files additional_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.additional_files
    ADD CONSTRAINT additional_files_pkey PRIMARY KEY (id);


--
-- TOC entry 4888 (class 2606 OID 16478)
-- Name: batteries batteries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batteries
    ADD CONSTRAINT batteries_pkey PRIMARY KEY (id);


--
-- TOC entry 4891 (class 2606 OID 16489)
-- Name: experiments experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_pkey PRIMARY KEY (id);


--
-- TOC entry 4904 (class 2606 OID 16653)
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- TOC entry 4895 (class 2606 OID 16572)
-- Name: updates updates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.updates
    ADD CONSTRAINT updates_pkey PRIMARY KEY (id);


--
-- TOC entry 4899 (class 2606 OID 16597)
-- Name: users users_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_login_key UNIQUE (login);


--
-- TOC entry 4901 (class 2606 OID 16595)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4886 (class 1259 OID 16668)
-- Name: batteries_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX batteries_created_by_idx ON public.batteries USING btree (created_by);


--
-- TOC entry 4889 (class 1259 OID 16676)
-- Name: experiments_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX experiments_created_by_idx ON public.experiments USING btree (created_by);


--
-- TOC entry 4902 (class 1259 OID 16660)
-- Name: sessions_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_active_idx ON public.sessions USING btree (expires_at) WHERE (revoked = false);


--
-- TOC entry 4905 (class 1259 OID 16659)
-- Name: sessions_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sessions_user_idx ON public.sessions USING btree (user_id);


--
-- TOC entry 4896 (class 1259 OID 16578)
-- Name: updates_table_row_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX updates_table_row_idx ON public.updates USING btree (table_name, row_id);


--
-- TOC entry 4897 (class 1259 OID 16579)
-- Name: updates_user_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX updates_user_date_idx ON public.updates USING btree (user_id, update_date DESC);


--
-- TOC entry 4906 (class 2606 OID 16663)
-- Name: batteries batteries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.batteries
    ADD CONSTRAINT batteries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4907 (class 2606 OID 16671)
-- Name: experiments experiments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT experiments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- TOC entry 4909 (class 2606 OID 16506)
-- Name: additional_files fk_additional_files_battery; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.additional_files
    ADD CONSTRAINT fk_additional_files_battery FOREIGN KEY (battery) REFERENCES public.batteries(id) ON DELETE CASCADE;


--
-- TOC entry 4908 (class 2606 OID 16490)
-- Name: experiments fk_battery; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT fk_battery FOREIGN KEY (battery) REFERENCES public.batteries(id) ON DELETE CASCADE;


--
-- TOC entry 4911 (class 2606 OID 16654)
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4910 (class 2606 OID 16598)
-- Name: updates updates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.updates
    ADD CONSTRAINT updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


-- Completed on 2026-01-31 22:07:20

--
-- PostgreSQL database dump complete
--

\unrestrict 719iM938i4RX7irGmfEpB9HDx5Lm20icGPE7cmJ1pPfSn8TkpUDtEb9LP9YmeZm


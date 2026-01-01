
CREATE SEQUENCE IF NOT EXISTS batteries_id_seq;

CREATE TABLE IF NOT EXISTS public.batteries
(
    id integer NOT NULL DEFAULT nextval('batteries_id_seq'::regclass),
    batch character varying NOT NULL,
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
    dcir_1s_ohms_25C_50soc real,
    dcir_5s_ohms_25C_50soc real,
    dcir_10s_ohms_25C_50soc real,
    dcir_10s_ohm_ah real,
    dcir_10s_siemens real,
    dcir_10s_siemens_wh real,
    dcir_30s_ohms_25C_50soc real,
    dcir_30s_ohm_ah real,
    dcir_30s_siemens real,
    dcir_30s_siemens_wh real,
    dcir_continuous_ohms_25C_50soc real,
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
    CONSTRAINT batteries_pkey PRIMARY KEY (id)
)
TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.batteries
OWNER TO postgres;

ALTER TABLE public.batteries
ADD COLUMN IF NOT EXISTS cell_type real; 

CREATE TABLE IF NOT EXISTS public.experiments ( 
    id serial PRIMARY KEY,
    battery integer NOT NULL,
    table_path character varying, 
    experiment_type  character varying,
    notes text,
    CONSTRAINT fk_battery
        FOREIGN KEY (battery)
        REFERENCES batteries(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.additional_files ( 
    id serial PRIMARY KEY,
    battery integer NOT NULL,
    file_path character varying, 
    filename character varying,
    notes text,
    CONSTRAINT fk_battery
        FOREIGN KEY (battery)
        REFERENCES batteries(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.updates ( 
    id serial PRIMARY KEY,
    experiment integer NOT NULL,
    file_path character varying, 
    filename character varying,
    notes text,
    CONSTRAINT fk_batt
        FOREIGN KEY (battery)
        REFERENCES batteries(id)
        ON DELETE CASCADE
);

BEGIN;

INSERT INTO public.experiments (battery, table_path, experiment_type, notes)
VALUES
  (1, 'data_base/batt_1/cycle_2025-12-20.csv',      'cycle',        'Cycle life test, 0.5C charge / 1C discharge, 25C'),
  (1, 'data_base/batt_1/dcir_2025-12-21.csv',       'dcir',         'DCIR pulses 1s/5s/10s at 50% SOC, 25C'),
  (2, 'data_base/batt_2/hppc_2025-12-18.csv',       'HPPC',         'Hybrid Pulse Power Characterization, SOC sweep'),
  (2, 'data_base/batt_2/cycle_2025-12-22.csv',      'cycle',        'Cycle test, 1C/1C, cutoff per spec'),
  (3, 'data_base/batt_3/calendar_2025-11-01.csv',   'calendar',     'Calendar ageing storage @60% SOC, 35C'),
  (3, 'data_base/batt_3/dcir_2025-12-05.csv',       'dcir',         'Repeat DCIR after 30 days storage'),
  (4, 'data_base/batt_4/charge_profile_2025-12-10.csv','charge',     'Fast charge profile 10->80% SOC'),
  (4, 'data_base/batt_4/discharge_power_2025-12-11.csv','power',     'Power test 5s/10s/30s pulses');

COMMIT;

UPDATE public.experiments
SET table_path = 'data_base/' || id::text || '.ndax';

SELECT * FROM public.experiments ORDER BY id;


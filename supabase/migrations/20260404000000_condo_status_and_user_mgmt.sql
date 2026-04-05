ALTER TABLE public.condos
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.profiles (id, nome, is_master)
SELECT id, email, true
FROM auth.users
WHERE email = 'jonatas@cs8gestao.com.br'
ON CONFLICT (id) DO UPDATE SET is_master = true;

CREATE INDEX IF NOT EXISTS idx_profiles_is_master ON public.profiles(is_master) WHERE is_master = true;

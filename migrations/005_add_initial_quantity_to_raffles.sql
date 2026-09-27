-- Migration: 005_add_initial_quantity_to_raffles.sql
-- Description: Adiciona coluna opcional initial_quantity na tabela raffles para sugestão inicial de cotas na interface.
-- Nota: Esta coluna é opcional (NULLable) e preserva a compatibilidade total com rifas legadas.

ALTER TABLE public.raffles
ADD COLUMN IF NOT EXISTS initial_quantity INTEGER DEFAULT NULL;

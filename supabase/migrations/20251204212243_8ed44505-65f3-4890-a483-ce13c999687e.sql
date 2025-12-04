-- Fix AI Agent Configuration Tables RLS - Remove PUBLIC access

-- Drop existing PUBLIC policies on agents table
DROP POLICY IF EXISTS "Public can view agents" ON public.agents;
DROP POLICY IF EXISTS "Public can insert agents" ON public.agents;
DROP POLICY IF EXISTS "Public can update agents" ON public.agents;
DROP POLICY IF EXISTS "Public can delete agents" ON public.agents;

-- Drop existing PUBLIC policies on agent_prompt_blocks table
DROP POLICY IF EXISTS "Public can view agent_prompt_blocks" ON public.agent_prompt_blocks;
DROP POLICY IF EXISTS "Public can insert agent_prompt_blocks" ON public.agent_prompt_blocks;
DROP POLICY IF EXISTS "Public can update agent_prompt_blocks" ON public.agent_prompt_blocks;
DROP POLICY IF EXISTS "Public can delete agent_prompt_blocks" ON public.agent_prompt_blocks;

-- Drop existing PUBLIC policies on agent_tools table
DROP POLICY IF EXISTS "Public can view agent_tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Public can insert agent_tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Public can update agent_tools" ON public.agent_tools;
DROP POLICY IF EXISTS "Public can delete agent_tools" ON public.agent_tools;

-- Create admin-only policies for agents table (global AI configuration)
CREATE POLICY "Admins can view agents"
ON public.agents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert agents"
ON public.agents
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agents"
ON public.agents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agents"
ON public.agents
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create admin-only policies for agent_prompt_blocks table
CREATE POLICY "Admins can view agent_prompt_blocks"
ON public.agent_prompt_blocks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert agent_prompt_blocks"
ON public.agent_prompt_blocks
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agent_prompt_blocks"
ON public.agent_prompt_blocks
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agent_prompt_blocks"
ON public.agent_prompt_blocks
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create admin-only policies for agent_tools table
CREATE POLICY "Admins can view agent_tools"
ON public.agent_tools
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert agent_tools"
ON public.agent_tools
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update agent_tools"
ON public.agent_tools
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete agent_tools"
ON public.agent_tools
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow service role (edge functions) to read agent configuration
-- This is implicit since service role bypasses RLS
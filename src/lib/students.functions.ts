import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailOrEmpty = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "Invalid email address",
  });

export const addStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; email?: string; gradeLevel?: string }) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: emailOrEmpty,
        gradeLevel: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!member?.account_id) throw new Error("No account");

    const { data: row, error } = await supabase
      .from("students")
      .insert({
        account_id: member.account_id,
        name: data.name,
        email: data.email ?? null,
        grade_level: data.gradeLevel ?? null,
      })
      .select("id, name, email, grade_level")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name?: string; email?: string; gradeLevel?: string }) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        email: emailOrEmpty,
        gradeLevel: z.string().trim().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { name?: string; email?: string | null; grade_level?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if ("email" in data) patch.email = data.email ?? null;
    if (data.gradeLevel !== undefined) patch.grade_level = data.gradeLevel;

    const { data: row, error } = await supabase
      .from("students")
      .update(patch)
      .eq("id", data.id)
      .select("id, name, email, grade_level")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Student not found");
    return row;
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("account_members")
      .select("account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!member?.account_id) throw new Error("No account");

    // Keep history intact: a student attached to lessons is not deletable.
    const { count } = await supabase
      .from("lessons")
      .select("*", { count: "exact", head: true })
      .eq("student_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error("This student has lessons on record and can't be removed.");
    }

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", data.id)
      .eq("account_id", member.account_id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });

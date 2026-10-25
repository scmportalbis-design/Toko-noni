"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Field, FormMessage, SubmitButton, inputClass } from "@/components/admin/form-ui";

export function LoginForm() {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          defaultValue={state?.values?.email ?? ""}
          className={inputClass}
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton pendingText="Masuk…">Masuk</SubmitButton>
      </div>
    </form>
  );
}

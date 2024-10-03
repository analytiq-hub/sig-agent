"use client"
import { signIn } from "next-auth/react"
import { Button } from "@mui/material"

export default function SignIn() {
  return (
    <Button
      variant="contained"
      color="primary"
      onClick={() => signIn("google")}
    >
      Sign in with Google
    </Button>
  )
}
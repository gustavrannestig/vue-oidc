<script setup lang="ts">
import { useOidcAuth } from "../../src/main";

const auth = useOidcAuth();
</script>

<template>
  <div>
    <a
      v-if="!auth?.isAuthenticated.value"
      style="cursor: pointer"
      @click="auth?.signinRedirect()"
      >Login</a
    >
    <a v-else style="cursor: pointer" @click="auth?.signoutRedirect()"
      >Logout</a
    >

    <h2>Is loading</h2>
    <pre>
      {{ auth?.isLoading }}
    </pre>
    <h2>Is logged in</h2>
    <pre>
      {{ auth?.isAuthenticated }}
    </pre>
    <h2>User</h2>
    <pre>
      {{ auth?.user }}
    </pre>
    <h2>Error</h2>
    <pre>
      {{ auth?.error }}
    </pre>
    <h2>Access token</h2>
    <pre>
      {{ auth?.user.value?.access_token }}
    </pre>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>

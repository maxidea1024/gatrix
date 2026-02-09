<script lang="ts">
  export let title: string;
  export let message: string;
  export let onConfirm: () => void;
  export let onCancel: () => void;
</script>

<div class="confirm-overlay">
  <div class="nes-container is-dark with-title confirm-dialog rumble-on-pop">
    <p class="title" style="background-color:#000">{title}</p>
    <p class="confirm-message">{message}</p>
    <div class="confirm-buttons">
      <button type="button" class="nes-btn" on:click={onCancel}>CANCEL</button>
      <button type="button" class="nes-btn is-error" on:click={onConfirm}>POWER OFF</button>
    </div>
  </div>
</div>

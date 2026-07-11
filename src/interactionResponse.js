async function sendEphemeralAfterUpdate(interaction, payload) {
  if (typeof interaction.followUp === 'function') {
    await interaction.followUp({ ...payload, ephemeral: true });
    return;
  }
  if (typeof interaction.reply === 'function') {
    await interaction.reply({ ...payload, ephemeral: true });
  }
}

module.exports = { sendEphemeralAfterUpdate };

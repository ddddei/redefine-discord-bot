function getChannelPermissions(channel, clientUser) {
  if (!channel || typeof channel.permissionsFor !== 'function' || !clientUser) return null;
  try { return channel.permissionsFor(clientUser); } catch (error) { return null; }
}

function channelPermissionHas(permissions, permission) {
  return Boolean(permissions && typeof permissions.has === 'function' && permissions.has(permission));
}

async function resolveConfiguredChannel(interaction, channelId) {
  const cachedChannel = interaction.client && interaction.client.channels && interaction.client.channels.cache
    && typeof interaction.client.channels.cache.get === 'function'
    ? interaction.client.channels.cache.get(channelId) : null;
  if (cachedChannel) return cachedChannel;
  if (!interaction.client || !interaction.client.channels || typeof interaction.client.channels.fetch !== 'function') return null;
  try { return await interaction.client.channels.fetch(channelId); } catch (error) { return null; }
}

module.exports = { channelPermissionHas, getChannelPermissions, resolveConfiguredChannel };

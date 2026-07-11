const { PermissionFlagsBits } = require('discord.js');

function getMemberDisplayName(user, member) {
  return member && member.displayName ? member.displayName : user.username;
}

function memberHasPermission(member, permission) {
  return Boolean(member && member.permissions && typeof member.permissions.has === 'function'
    && member.permissions.has(permission));
}

function isOperator(interaction) {
  return memberHasPermission(interaction.member, PermissionFlagsBits.ManageMessages)
    || memberHasPermission(interaction.member, PermissionFlagsBits.Administrator);
}

function getConfiguredEnvValue(envName) {
  const value = process.env[envName];
  return typeof value === 'string' ? value.trim() : '';
}

module.exports = { getConfiguredEnvValue, getMemberDisplayName, isOperator, memberHasPermission };

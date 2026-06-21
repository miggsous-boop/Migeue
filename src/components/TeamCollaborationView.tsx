import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Copy, 
  Check, 
  Trash2, 
  Mail, 
  Shield, 
  Crown,
  Share2,
  AlertCircle,
  Clock,
  Send,
  Lock,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCachedAccessToken, setCachedAccessToken } from '../firebase';
import { TeamMember } from '../types';

interface TeamCollaborationViewProps {
  user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null } | null;
  teamMembers: TeamMember[];
  currentUserRole?: 'Administrador' | 'Editor' | 'Visualizador' | null;
  onFirestoreError: (err: any, op: string, path: string) => void;
  onAskConfirmation?: (options: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  }) => void;
  onInviteMember: (newMember: TeamMember) => void;
  onRemoveMember: (id: string) => void;
}

const makeRawEmail = (to: string, from: string, subjectStr: string, bodyText: string) => {
  const base64EncodeUnicode = (str: string) => {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const utf8Subject = `=?utf-8?B?${base64EncodeUnicode(subjectStr)}?=`;
  const emailLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Date: ${new Date().toUTCString()}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64EncodeUnicode(bodyText)
  ];
  const emailStr = emailLines.join('\r\n');
  return base64EncodeUnicode(emailStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const sendInviteEmail = async (toEmail: string, roleName: string, inviterName: string, inviterEmail: string, accessToken: string) => {
  const inviteUrl = window.location.origin;
  const appName = "Ciclocar Bike Shop";

  const subject = `Convite para se juntar à equipe de ${appName}`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
        <h2 style="color: #2563eb; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">📦 ${appName}</h2>
        <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px; font-weight: 500;">Controle e Sincronização em Tempo Real</p>
      </div>
      <div style="color: #334155; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        <p style="margin-top: 0;">Olá,</p>
        <p>Você foi convidado por <strong>${inviterName}</strong> para colaborar no gerenciamento do estoque da empresa como <strong>${roleName}</strong>.</p>
        <p>Ao aceitar, você poderá consultar todo o painel de produtos, acompanhar o histórico de movimentações e registrar entradas ou saídas de materiais de forma sincronizada.</p>
      </div>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 28px; background-color: #1e293b; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; transition: all 150ms ease-in;">
          Aceitar Convite & Acessar Sistema
        </a>
      </div>
      <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.5;">
        <p style="margin: 0;">Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <p style="margin: 8px 0 0 0; word-break: break-all; color: #2563eb;">${inviteUrl}</p>
      </div>
    </div>
  `;

  const fromNameFormatted = inviterName ? `${inviterName} <${inviterEmail}>` : inviterEmail;
  const rawMessage = makeRawEmail(toEmail, fromNameFormatted, subject, htmlBody);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: rawMessage
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Erro do Gmail API: ${response.status} - ${errBody}`);
    }
    
    return true;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('A resposta da API do Gmail esgotou o tempo limite (Timeout de 8 segundos). Esse bloqueio é comum se a chave de rede ou o navegador impedirem conexões externas.');
    }
    throw err;
  }
};

export default function TeamCollaborationView({ 
  user, 
  teamMembers,
  currentUserRole,
  onFirestoreError,
  onAskConfirmation,
  onInviteMember,
  onRemoveMember
}: TeamCollaborationViewProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Administrador' | 'Editor' | 'Visualizador'>('Editor');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [gmailToken, setGmailToken] = useState<string | null>(getCachedAccessToken());

  // Post-Invite manual sharing states
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitedRole, setInvitedRole] = useState('');
  const [showInviteActions, setShowInviteActions] = useState(false);

  const handleAuthorizeGmail = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    // Mock autorization offline
    setCachedAccessToken("local-gmail-token-mock");
    setGmailToken("local-gmail-token-mock");
    setSuccessMsg('Compartilhamento via Gmail simulado habilitado nesta sessão!');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('Você precisa estar autenticado para convidar membros.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Por favor, informe um email válido.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Por favor, digite um formato de email válido.');
      return;
    }

    if (cleanEmail === user.email?.toLowerCase()) {
      setErrorMsg('Você não pode convidar a si mesmo.');
      return;
    }

    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    setShowInviteActions(false);

    try {
      const newMember: TeamMember = {
        id: cleanEmail,
        email: cleanEmail,
        role,
        status: 'Pendente',
        invitedBy: user.displayName || user.email || 'Membro',
        invitedByEmail: user.email || '',
        invitedAt: new Date().toISOString()
      };

      onInviteMember(newMember);

      // Store invited details so we can render action tools below the form
      setInvitedEmail(cleanEmail);
      setInvitedRole(role);
      setShowInviteActions(true);

      setSuccessMsg(`Sucesso! O convite para ${cleanEmail} como ${role} foi adicionado à equipe.`);
      setEmail('');
      setRole('Editor');
      
      setTimeout(() => {
        setSuccessMsg('');
      }, 9000);
    } catch (error: any) {
      console.error('Error sending invite:', error);
      setErrorMsg(error.message || 'Erro ao registrar convite localmente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (id: string, memberEmail: string) => {
    const proceedWithDeletion = async () => {
      setErrorMsg('');
      setSuccessMsg('');

      try {
        onRemoveMember(id);
        setSuccessMsg(`Membro ${memberEmail} removido com sucesso.`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } catch (error: any) {
        console.error('Error deleting member:', error);
        setErrorMsg('Não foi possível remover o membro.');
      }
    };

    if (onAskConfirmation) {
      onAskConfirmation({
        title: 'Remover Membro da Equipe',
        message: `Tem certeza que deseja remover o convite/membro corporativo (${memberEmail}) de forma irreversível?`,
        type: 'danger',
        confirmLabel: 'Sim, remover',
        cancelLabel: 'Cancelar',
        onConfirm: proceedWithDeletion
      });
    } else {
      if (window.confirm(`Tem certeza que deseja remover o convite/membro (${memberEmail})?`)) {
        await proceedWithDeletion();
      }
    }
  };

  const copyInviteLink = () => {
    const inviteLink = window.location.origin;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  return (
    <div className="space-y-8 py-2">
      {/* Intro info card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-10 pointer-events-none">
          <Users className="w-80 h-80" />
        </div>
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-bold tracking-wide backdrop-blur-md">
            <Share2 className="w-3.5 h-3.5" />
            Sincronização Ativa
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display">
            Controle de Equipes & Dados Compartilhados
          </h2>
          <p className="text-blue-100 text-xs md:text-sm font-medium leading-relaxed">
            Compartilhe seu estoque em tempo real com parceiros e colaboradores. Todos os membros convidados acessam as mesmas coleções instantaneamente após o login utilizando Conta Google.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* New user invite form & Quick copy link */}
        <div className="space-y-6">
          {currentUserRole !== 'Administrador' ? (
            <div className="bg-white rounded-2xl border border-slate-150 p-6 space-y-4 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-slate-850 font-extrabold text-sm font-display">Acesso de Administrador Requerido</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Apenas administradores do sistema podem convidar novos integrantes, alterar funções ou gerenciar as chaves de acesso.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-xs relative">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <UserPlus className="w-4.5 h-4.5 text-blue-600" />
                <h3 className="text-slate-800 font-extrabold text-sm font-display">Convidar Novo Integrante</h3>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    E-mail do Colaborador
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ex: parceiro@empresa.com"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Função de Permissão
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      role === 'Editor' 
                        ? 'border-blue-400 bg-blue-50/40 text-blue-900' 
                        : 'border-slate-150 bg-slate-50 text-slate-700 hover:bg-slate-100/70'
                    }`}>
                      <input
                        type="radio"
                        name="role"
                        checked={role === 'Editor'}
                        onChange={() => setRole('Editor')}
                        className="sr-only"
                      />
                      <Shield className={`w-4 h-4 mt-0.5 shrink-0 ${role === 'Editor' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className="text-xs font-bold leading-none">Editor / Operador</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                          Pode adicionar produtos, editar valores de estoque e registrar entradas/saídas livremente.
                        </p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      role === 'Administrador' 
                        ? 'border-indigo-400 bg-indigo-50/40 text-indigo-900' 
                        : 'border-slate-150 bg-slate-50 text-slate-700 hover:bg-slate-100/70'
                    }`}>
                      <input
                        type="radio"
                        name="role"
                        checked={role === 'Administrador'}
                        onChange={() => setRole('Administrador')}
                        className="sr-only"
                      />
                      <Crown className={`w-4 h-4 mt-0.5 shrink-0 ${role === 'Administrador' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className="text-xs font-bold leading-none">Administrador</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                          Controle total. Pode excluir itens, gerenciar outros membros e controlar todo o estoque.
                        </p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      role === 'Visualizador' 
                        ? 'border-teal-400 bg-teal-50/40 text-teal-900' 
                        : 'border-slate-150 bg-slate-50 text-slate-700 hover:bg-slate-100/70'
                    }`}>
                      <input
                        type="radio"
                        name="role"
                        checked={role === 'Visualizador'}
                        onChange={() => setRole('Visualizador')}
                        className="sr-only"
                      />
                      <Users className={`w-4 h-4 mt-0.5 shrink-0 ${role === 'Visualizador' ? 'text-teal-650' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className="text-xs font-bold leading-none">Apenas Visualização</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                          Acesso de consulta. Permite acompanhar as mudanças do estoque e auditoria sem alterar dados.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                    <span>Envio por E-mail</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 font-extrabold uppercase">
                      Disparo Manual
                    </span>
                  </label>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-650 text-xs shadow-none">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-slate-700 block text-[11px]">Banco de Dados Local (Offline)</span>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                          Para máxima segurança e privacidade, seu estoque funciona por arquivos de backup locais. Após convidar, você poderá disparar o e-mail pelo seu próprio Gmail/Outlook ou copiar as instruções de conexão com o parceiro.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status messages inside form */}
                <AnimatePresence mode="wait">
                  {errorMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-150 text-rose-800 rounded-xl text-xs font-medium"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}

                  {successMsg && (
                    <motion.div 
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-xl text-xs font-medium"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{successMsg}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold font-display transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Registrando convite...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Adicionar Convite Local</span>
                    </>
                  )}
                </button>
              </form>

              {/* POST-INVITE DYNAMIC ACTION BOX */}
              <AnimatePresence>
                {showInviteActions && invitedEmail && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-slate-100 pt-4 mt-4 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="w-4.5 h-4.5 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <strong className="font-extrabold text-slate-850 block text-[11px]">Como deseja enviar o convite?</strong>
                        <span className="text-[10px] text-slate-500 font-medium">Os dados foram gravados. Forneça o convite ao parceiro por:</span>
                      </div>
                    </div>
                    
                    <div className="text-[10px] bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 leading-relaxed space-y-1">
                      <span className="block font-bold text-slate-500 uppercase tracking-wider">E-mail: <strong className="text-slate-850 font-mono font-normal">{invitedEmail}</strong></span>
                      <span className="block font-bold text-slate-500 uppercase tracking-wider">Nível de Permissão: <strong className="text-slate-850 font-sans font-extrabold">{invitedRole}</strong></span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <a
                        href={`mailto:${invitedEmail}?subject=${encodeURIComponent("Convite: Colaborador no Ciclocar Bike Shop")}&body=${encodeURIComponent(
                          `Olá!\n\nVocê foi convidado como ${invitedRole} por ${user?.displayName || user?.email} para gerenciar a equipe do Ciclocar Bike Shop local.\n\nComo o aplicativo agora opera em formato totalmente offline, seguro e local no próprio navegador para privacidade total dos dados, siga as etapas rápidas abaixo para conectar:\n\n1. Abra o link do aplicativo no seu computador ou celular:\n${window.location.origin}\n\n2. Realize o login inserindo o seu endereço de e-mail de convite:\n${invitedEmail}\n\n3. Para visualizar a base atualizada de produtos, solicite ao seu administrador o arquivo ".json" de backup mais recente do estoque. Vá na aba "Estoque" -> botão "Restaurar Backup Local" e selecione o arquivo que lhe foi enviado.\n\nPronto! Seja bem-vindo à equipe.\n\nQualquer dúvida, fale comigo!`
                        )}`}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Disparar via E-mail Local</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const inviteMsgText = `Olá!\n\nVocê está sendo convidado como ${invitedRole} por ${user?.displayName || user?.email} para gerenciar a equipe do Ciclocar Bike Shop.\n\nComo o aplicativo opera em formato 100% seguro e local no navegador, siga estas instruções para conectar:\n\n1. Abra o aplicativo: ${window.location.origin}\n2. Faça login informando seu e-mail: ${invitedEmail}\n3. Importe o arquivo recente de backup (.json) que estou lhe enviando em anexo (vá na aba "Estoque" -> clique em "Restaurar Backup Local").\n\nSeja bem-vindo!`;
                          navigator.clipboard.writeText(inviteMsgText);
                          alert('Instruções copiadas para a área de transferência! Envie pelo WhatsApp ou de forma direta.');
                        }}
                        className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copiar Mensagem (WhatsApp)</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Shared invitations list / stats */}
          <div className="bg-slate-50 rounded-2xl border border-slate-150 p-6 relative">
            <h4 className="text-slate-800 font-extrabold text-xs uppercase tracking-wider mb-2 font-display">
              Segurança Integrada
            </h4>
            <p className="text-slate-550 text-[11px] leading-relaxed">
              Os convites locais cadastrados acima definem os privilégios rígidos e invioláveis de cada colaborador.
              Quando um parceiro realizar o login usando seu respectivo e-mail, seu cargo (Visualizador, Editor ou Administrador) será resolvido automaticamente e assegurado pelo sistema local a partir do backup que o administrador fornecer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

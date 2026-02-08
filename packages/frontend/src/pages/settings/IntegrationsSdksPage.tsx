import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  alpha,
  Chip,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight as ChevronRightIcon,
  Info as InfoIcon,
  Storage as ServerIcon,
  Language as WebIcon,
  StayCurrentPortrait as MobileIcon,
  SportsEsports as GameIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';

// SDK Icons
import nodeIcon from '@/assets/icons/sdks/node.svg';
import javaIcon from '@/assets/icons/sdks/java.svg';
import pythonIcon from '@/assets/icons/sdks/python.svg';
import goIcon from '@/assets/icons/sdks/go.svg';
import dotnetIcon from '@/assets/icons/sdks/dotnet.svg';
import rubyIcon from '@/assets/icons/sdks/ruby.svg';
import phpIcon from '@/assets/icons/sdks/php.svg';
import rustIcon from '@/assets/icons/sdks/rust.svg';
import elixirIcon from '@/assets/icons/sdks/elixir.svg';
import cppIcon from '@/assets/icons/sdks/cplusplus.svg';

import reactIcon from '@/assets/icons/sdks/react.svg';
import vueIcon from '@/assets/icons/sdks/vue.svg';
import svelteIcon from '@/assets/icons/sdks/svelte.svg';
import nextjsIcon from '@/assets/icons/sdks/nextjs.svg';
import angularIcon from '@/assets/icons/sdks/angular.svg';
import nuxtIcon from '@/assets/icons/sdks/nuxt.svg';
import solidIcon from '@/assets/icons/sdks/solid.svg';
import tsIcon from '@/assets/icons/sdks/typescript.svg';
import jsIcon from '@/assets/icons/sdks/javascript.svg';

import androidIcon from '@/assets/icons/sdks/android.svg';
import iosIcon from '@/assets/icons/sdks/ios.svg';
import flutterIcon from '@/assets/icons/sdks/flutter.svg';
import swiftIcon from '@/assets/icons/sdks/swift.svg';
import kotlinIcon from '@/assets/icons/sdks/kotlin.svg';

import unrealIcon from '@/assets/icons/sdks/unreal.svg';
import unityIcon from '@/assets/icons/sdks/unity.svg';
import cocosIcon from '@/assets/icons/sdks/cocos.svg';
import godotIcon from '@/assets/icons/sdks/godot.svg';
import luaIcon from '@/assets/icons/sdks/lua.svg';
import gamemakerIcon from '@/assets/icons/sdks/gamemaker.svg';
import cryengineIcon from '@/assets/icons/sdks/cryengine.svg';
import robloxIcon from '@/assets/icons/sdks/roblox.svg';
import bevyIcon from '@/assets/icons/sdks/bevy.svg';
import raylibIcon from '@/assets/icons/sdks/raylib.svg';

interface SdkProvider {
  name: string;
  displayName: string;
  type: string;
  description: string;
  icon: string;
  isServer?: boolean;
  adaptive?: boolean;
}

const SERVER_SDKS: SdkProvider[] = [
  {
    name: 'nodejs',
    displayName: 'Node.js',
    type: 'Server-side',
    description: 'Node.js server-side SDK for Gatrix integration.',
    icon: nodeIcon,
    isServer: true,
  },
  {
    name: 'java',
    displayName: 'Java',
    type: 'Server-side',
    description: 'Java server-side and client SDK.',
    icon: javaIcon,
    isServer: true,
  },
  {
    name: 'python',
    displayName: 'Python',
    type: 'Server-side',
    description: 'Python server-side SDK for Gatrix integration.',
    icon: pythonIcon,
    isServer: true,
  },
  {
    name: 'go',
    displayName: 'Go',
    type: 'Server-side',
    description: 'Go language server-side SDK.',
    icon: goIcon,
    isServer: true,
  },
  {
    name: 'dotnet',
    displayName: '.NET',
    type: 'Server-side',
    description: '.NET server-side and client SDK.',
    icon: dotnetIcon,
    isServer: true,
  },
  {
    name: 'rust',
    displayName: 'Rust',
    type: 'Server-side',
    description: 'High-performance Rust SDK.',
    icon: rustIcon,
    isServer: true,
  },
  {
    name: 'elixir',
    displayName: 'Elixir',
    type: 'Server-side',
    description: 'Erlang VM (BEAM) based Elixir SDK.',
    icon: elixirIcon,
    isServer: true,
  },
  {
    name: 'cpp',
    displayName: 'C++',
    type: 'Server-side',
    description: 'System-level C++ SDK.',
    icon: cppIcon,
    isServer: true,
  },
  {
    name: 'ruby',
    displayName: 'Ruby',
    type: 'Server-side',
    description: 'Ruby server-side SDK for Gatrix integration.',
    icon: rubyIcon,
    isServer: true,
  },
  {
    name: 'php',
    displayName: 'PHP',
    type: 'Server-side',
    description: 'PHP server-side SDK for Gatrix integration.',
    icon: phpIcon,
    isServer: true,
  },
];

const WEB_SDKS: SdkProvider[] = [
  {
    name: 'react',
    displayName: 'React',
    type: 'Web Framework',
    description: 'React client-side SDK for web applications.',
    icon: reactIcon,
  },
  {
    name: 'nextjs',
    displayName: 'Next.js',
    type: 'Web Framework',
    description: 'Fullstack Next.js SDK (Client/Server components).',
    icon: nextjsIcon,
  },
  {
    name: 'vue',
    displayName: 'Vue.js',
    type: 'Web Framework',
    description: 'Vue.js client-side SDK for web applications.',
    icon: vueIcon,
  },
  {
    name: 'nuxt',
    displayName: 'Nuxt',
    type: 'Web Framework',
    description: 'Vue-based Nuxt framework SDK.',
    icon: nuxtIcon,
  },
  {
    name: 'svelte',
    displayName: 'Svelte',
    type: 'Web Framework',
    description: 'Hyper-efficient Svelte SDK.',
    icon: svelteIcon,
  },
  {
    name: 'angular',
    displayName: 'Angular',
    type: 'Web Framework',
    description: 'Enterprise-grade Angular SDK.',
    icon: angularIcon,
  },
  {
    name: 'solid',
    displayName: 'SolidJS',
    type: 'Web Framework',
    description: 'High-performance SolidJS SDK.',
    icon: solidIcon,
  },
  {
    name: 'typescript',
    displayName: 'TypeScript',
    type: 'Browser',
    description: 'Universal TypeScript client SDK.',
    icon: tsIcon,
  },
  {
    name: 'javascript',
    displayName: 'JavaScript',
    type: 'Browser',
    description: 'Universal JavaScript client SDK.',
    icon: jsIcon,
  },
];

const MOBILE_SDKS: SdkProvider[] = [
  {
    name: 'android',
    displayName: 'Android',
    type: 'Mobile',
    description: 'Android native client-side SDK.',
    icon: androidIcon,
  },
  {
    name: 'ios',
    displayName: 'iOS',
    type: 'Mobile',
    description: 'iOS native client-side SDK.',
    icon: iosIcon,
  },
  {
    name: 'flutter',
    displayName: 'Flutter',
    type: 'Mobile',
    description: 'Flutter cross-platform client-side SDK.',
    icon: flutterIcon,
  },
  {
    name: 'kotlin',
    displayName: 'Kotlin',
    type: 'Mobile',
    description: 'Kotlin Multiplatform / Native SDK.',
    icon: kotlinIcon,
  },
  {
    name: 'swift',
    displayName: 'Swift',
    type: 'Mobile',
    description: 'Swift native iOS/macOS SDK.',
    icon: swiftIcon,
  },
  {
    name: 'reactnative',
    displayName: 'React Native',
    type: 'Mobile',
    description: 'React Native cross-platform SDK.',
    icon: reactIcon,
  },
];

const GAME_ENGINE_SDKS: SdkProvider[] = [
  {
    name: 'unreal',
    displayName: 'Unreal Engine',
    type: 'Game Engine',
    description: 'Unreal Engine native C++ SDK.',
    icon: unrealIcon,
    adaptive: true,
  },
  {
    name: 'unity',
    displayName: 'Unity',
    type: 'Game Engine',
    description: 'Unity C# SDK for cross-platform games.',
    icon: unityIcon,
  },
  {
    name: 'roblox',
    displayName: 'Roblox',
    type: 'Game Engine',
    description: 'Roblox Luau SDK for game creators.',
    icon: robloxIcon,
  },
  {
    name: 'cocos',
    displayName: 'Cocos',
    type: 'Game Engine',
    description: 'Cocos2d-x / Cocos Creator SDK.',
    icon: cocosIcon,
  },
  {
    name: 'godot',
    displayName: 'Godot',
    type: 'Game Engine',
    description: 'Godot Engine GDScript/C# SDK.',
    icon: godotIcon,
  },
  {
    name: 'gamemaker',
    displayName: 'GameMaker',
    type: 'Game Engine',
    description: 'GameMaker GML SDK for 2D games.',
    icon: gamemakerIcon,
  },
  {
    name: 'cryengine',
    displayName: 'CryEngine',
    type: 'Game Engine',
    description: 'CryEngine C++/C# SDK.',
    icon: cryengineIcon,
    adaptive: true,
  },
  {
    name: 'bevy',
    displayName: 'Bevy',
    type: 'Game Engine',
    description: 'Data-driven Bevy Engine Rust SDK.',
    icon: bevyIcon,
    adaptive: true,
  },
  {
    name: 'raylib',
    displayName: 'Raylib',
    type: 'Game Engine',
    description: 'Raylib C/C++ integration.',
    icon: raylibIcon,
    adaptive: true,
  },
  {
    name: 'lua',
    displayName: 'Lua',
    type: 'Scripting',
    description: 'Universal Lua SDK for scripted environments.',
    icon: luaIcon,
  },
];

const SdkCard: React.FC<{ sdk: SdkProvider }> = ({ sdk }) => {
  return (
    <Card
      sx={{
        height: 156,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s',
        opacity: 0.8,
        border: 1,
        borderColor: 'divider',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          transform: 'translateY(-4px)',
          opacity: 1,
          borderColor: 'primary.main',
        },
      }}
    >
      <CardContent sx={{ flex: 1, py: 1.5, px: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1.2} sx={{ minWidth: 0, flex: 1 }}>
            {sdk.adaptive ? (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  opacity: 0.9,
                  bgcolor: 'text.primary',
                  mask: `url(${sdk.icon}) no-repeat center / contain`,
                  WebkitMask: `url(${sdk.icon}) no-repeat center / contain`,
                }}
              />
            ) : (
              <Box
                component="img"
                src={sdk.icon}
                alt={sdk.displayName}
                sx={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  opacity: 0.9,
                }}
              />
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body1" fontWeight="bold" noWrap sx={{ lineHeight: 1.2 }}>
                {sdk.displayName}
              </Typography>
              <Chip
                label={sdk.type}
                size="small"
                variant="outlined"
                sx={{ height: 16, fontSize: '0.6rem', mt: 0.2 }}
              />
            </Box>
          </Box>
          <Chip
            label="Coming Soon"
            size="small"
            variant="outlined"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              color: 'text.secondary',
              borderColor: 'divider',
            }}
          />
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '1.3em',
            height: '2.6em',
          }}
        >
          {sdk.description}
        </Typography>
      </CardContent>
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Button
          size="small"
          disabled
          endIcon={<ChevronRightIcon sx={{ fontSize: '0.9rem !important' }} />}
          sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 0 }}
        >
          문서 보기
        </Button>
      </Box>
    </Card>
  );
};

const IntegrationsSdksPage: React.FC = () => {
  const { t } = useTranslation();

  const openDocs = (path: string) => {
    window.open(`/docs${path}`, '_blank');
  };

  const SdkGrid = ({ sdks }: { sdks: SdkProvider[] }) => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(auto-fill, minmax(280px, 1fr))',
          md: 'repeat(auto-fill, minmax(320px, 1fr))',
        },
        gap: 3,
      }}
    >
      {sdks.map((sdk) => (
        <SdkCard key={sdk.name} sdk={sdk} />
      ))}
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 4 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('integrations.sdks.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('integrations.sdks.subtitle')}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          p: 2,
          mb: 4,
          borderRadius: 2,
          bgcolor: (theme) => alpha(theme.palette.info.main, 0.05),
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.info.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <InfoIcon color="info" fontSize="small" />
        <Typography variant="body2" color="info.main" sx={{ fontWeight: 500 }}>
          SDK들은 현재 준비 중이며, 추후 순차적으로 공개될 예정입니다. 준비가 완료되면 문서와 함께
          활성화됩니다.
        </Typography>
      </Box>

      {/* Server-side SDKs */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ServerIcon color="action" fontSize="small" />
          <Typography variant="h6" fontWeight="600">
            Server-side SDKs
          </Typography>
          <Tooltip title="서버사이드 SDK 관련 문서 보기" arrow>
            <IconButton
              size="small"
              sx={{ ml: 0.5, color: 'text.secondary' }}
              onClick={() => openDocs('/sdks/server-side')}
            >
              <HelpIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('integrations.sdks.server.description')}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <SdkGrid sdks={SERVER_SDKS} />
      </Box>

      {/* Web Framework SDKs */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <WebIcon color="action" fontSize="small" />
          <Typography variant="h6" fontWeight="600">
            Web Framework SDKs
          </Typography>
          <Tooltip title="웹 프레임워크 SDK 관련 문서 보기" arrow>
            <IconButton
              size="small"
              sx={{ ml: 0.5, color: 'text.secondary' }}
              onClick={() => openDocs('/sdks/client-side')}
            >
              <HelpIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          웹 애플리케이션 프레임워크에서 사용할 수 있는 공식 SDK 목록입니다.
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <SdkGrid sdks={WEB_SDKS} />
      </Box>

      {/* Mobile SDKs */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <MobileIcon color="action" fontSize="small" />
          <Typography variant="h6" fontWeight="600">
            Mobile SDKs
          </Typography>
          <Tooltip title="모바일 SDK 관련 문서 보기" arrow>
            <IconButton
              size="small"
              sx={{ ml: 0.5, color: 'text.secondary' }}
              onClick={() => openDocs('/sdks/client-side')}
            >
              <HelpIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          모바일 애플리케이션 환경에서 사용할 수 있는 공식 SDK 목록입니다.
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <SdkGrid sdks={MOBILE_SDKS} />
      </Box>

      {/* Game Engine SDKs */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <GameIcon color="action" fontSize="small" />
          <Typography variant="h6" fontWeight="600">
            Game Engine SDKs
          </Typography>
          <Tooltip title="게임 엔진용 SDK 관련 문서 보기" arrow>
            <IconButton
              size="small"
              sx={{ ml: 0.5, color: 'text.secondary' }}
              onClick={() => openDocs('/sdks/game-engines')}
            >
              <HelpIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('integrations.sdks.game.description')}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <SdkGrid sdks={GAME_ENGINE_SDKS} />
      </Box>
    </Box>
  );
};

export default IntegrationsSdksPage;

import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createSignal, on, onMount, Show, type FlowComponent } from "solid-js";
import toast from "solid-toast";
import { ProfileInexistentError } from "~/api/requests/person/me";
import PullableScreen from "~/components/pullable-screen";
import feed from "~/stores/feed";
import feedFof from "~/stores/feed-fof";
import me from "~/stores/me";
import moment from "~/stores/moment"
import MdiRefresh from "~icons/mdi/refresh";
import MdiArchive from "~icons/mdi/archive";
import { promptForPermissions } from "~/utils/permissions";
import BottomNavigation from "~/components/bottom-navigation";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import MdiChevronDown from '~icons/mdi/chevron-down'
import MdiCheck from '~icons/mdi/check'

const FeedLayout: FlowComponent = (props) => {
  const navigate = useNavigate();

  const view = createMemo(() => {
    const path = useLocation().pathname.split("/").pop();

    if (path === "friends") {
      return "friends";
    }

    return "friends-of-friends";
  });

  const [isRefreshing, setIsRefreshing] = createSignal(false);
  const [isArchiving, setIsArchiving] = createSignal(false);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);

      await me.refetch();
      await Promise.all([
        void async function () {
          await feed.refetch();

          if (view() === "friends-of-friends") {
            await feedFof.refetch();
          }
        }(),
        moment.refetch()
      ]);
    }
    catch (error) {
      if (error instanceof ProfileInexistentError) {
        navigate("/create-profile");
      }
      else {
        console.error("[FeedLayout::handleRefresh]:", error);

        if (error instanceof Error) {
          toast.error(error.message);
        }
        else {
          // Whatever the error is, we'll just show it as a string.
          toast.error("An unknown error occurred: " + String(error));
        }

      }
    }
    finally {
      setIsRefreshing(false);
    }
  };

  const handleArchive = async () => {
    try {
      setIsArchiving(true);
      const count = await feed.archiveFeed();
      toast.success(`Saved ${count} posts`);
    } catch (error) {
      console.error("[FeedLayout::handleArchive]:", error);
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsArchiving(false);
    }
  };

  onMount(async () => {
    // Ask the user for notification permissions.
    await promptForPermissions();
  });

  createEffect(on(view, async () => {
    // Automatically refresh whenever the user navigates to the feed.
    await handleRefresh();
  }));

  return (
    <>
      <header class="pt-[env(safe-area-inset-top)]">
        <nav class="flex items-center justify-between gap-4 px-8 h-[72px]">
          {/* <a href="/friends/connections" aria-label="Relationships">
            <MdiPeople class="text-xl" />
          </a> */}

          {/* <p
            class="text-2xl text-center text-white font-700"
            role="banner"
          >
            Friends
          </p> */}

          <DropdownMenu preventScroll={false}>
            <DropdownMenu.Trigger class="flex items-center gap-2 text-2xl text-center text-white font-700">
              <span>{view() === "friends" ? "Friends" : "Friends of Friends"}</span>
              <DropdownMenu.Icon class="kobalte-expanded:rotate-180 transition-transform">
                <MdiChevronDown />
              </DropdownMenu.Icon>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content class="transform-origin-[var(--kb-menu-content-transform-origin)] mt-2 z-50 bg-white/5 w-[240px] backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl animate-[contentHide_200ms_ease-in_forwards] kobalte-expanded:animate-[contentShow_200ms_ease-out]">
                <DropdownMenu.Item class="px-4 py-2 cursor-pointer kobalte-highlighted:bg-white/5 transition-colors flex items-center justify-between"
                  onSelect={() => {
                    navigate("/feed/friends");
                  }}
                >
                  Friends
                  <Show when={view() === "friends"}>
                    <MdiCheck />
                  </Show>
                </DropdownMenu.Item>
                <DropdownMenu.Item class="px-4 py-2 border-t border-white/10 cursor-pointer kobalte-highlighted:bg-white/5 transition-colors flex items-center justify-between"
                  onSelect={() => {
                    navigate("/feed/friends-of-friends");
                  }}
                >
                  Friends of Friends
                  <Show when={view() === "friends-of-friends"}>
                    <MdiCheck />
                  </Show>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>

          <div class="flex items-center gap-2">
            <Show when={view() === "friends"}>
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving()}
                title="Archive feed"
              >
                <MdiArchive
                  class="text-white text-2xl rounded-full p-1"
                  classList={{
                    "animate-spin text-white/50 bg-white/10": isArchiving(),
                  }}
                />
              </button>
            </Show>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing()}
              title="Refresh feed & last moment"
            >
              <MdiRefresh
                class="text-white text-2xl rounded-full p-1"
                classList={{
                  "animate-spin text-white/50 bg-white/10": isRefreshing(),
                }}
              />
            </button>
          </div>
        </nav>
      </header>

      <div class="pt-4 pb-32 mb-[env(safe-area-inset-bottom)]">
        <PullableScreen onRefresh={handleRefresh}>
          <main>
            {props.children}
          </main>
        </PullableScreen>
      </div>

      <BottomNavigation />
    </>
  )
};

export default FeedLayout;

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Store } from '@ngxs/store';
import { Observable, Subscription } from 'rxjs';

import { StatusWrapper } from '../../stream.component';
import { MastodonService } from '../../../../services/mastodon.service';
import { AccountInfo } from '../../../../states/accounts.state';
import { Status, Results } from '../../../../services/models/mastodon.interfaces';
// import { map } from "rxjs/operators";

@Component({
    selector: 'app-action-bar',
    templateUrl: './action-bar.component.html',
    styleUrls: ['./action-bar.component.scss']
})
export class ActionBarComponent implements OnInit, OnDestroy {

    @Input() statusWrapper: StatusWrapper;
    @Output() replyEvent = new EventEmitter();

    isFavorited: boolean;
    isBoosted: boolean;

    isBoostLocked: boolean;
    isLocked: boolean;

    private isProviderSelected: boolean;
    private selectedAccounts: AccountInfo[];

    private favoriteStatePerAccountId: { [id: string]: boolean; } = {};
    private bootedStatePerAccountId: { [id: string]: boolean; } = {};

    private accounts$: Observable<AccountInfo[]>;
    private accountSub: Subscription;

    constructor(
        private readonly store: Store,
        private readonly mastodonService: MastodonService) {

        this.accounts$ = this.store.select(state => state.registeredaccounts.accounts);
    }

    ngOnInit() {
        // const selectedAccounts = this.getSelectedAccounts();
        // this.checkStatus(selectedAccounts);

        const status = this.statusWrapper.status;
        const account = this.statusWrapper.provider;
        this.favoriteStatePerAccountId[account.id] = status.favourited;
        this.bootedStatePerAccountId[account.id] = status.reblogged;

        this.accountSub = this.accounts$.subscribe((accounts: AccountInfo[]) => {
            this.checkStatus(accounts);
        });
    }

    ngOnDestroy(): void {
        this.accountSub.unsubscribe();
    }

    private checkStatus(accounts: AccountInfo[]): void {
        const status = this.statusWrapper.status;
        const provider = this.statusWrapper.provider;
        this.selectedAccounts = accounts.filter(x => x.isSelected);
        this.isProviderSelected = this.selectedAccounts.filter(x => x.id === provider.id).length > 0;

        if (status.visibility === 'direct' || status.visibility === 'private') {
            this.isBoostLocked = true;
        } else {
            this.isBoostLocked = false;
        }

        if ((status.visibility === 'direct' || status.visibility === 'private') && !this.isProviderSelected) {
            this.isLocked = true;
        } else {
            this.isLocked = false;
        }

        this.checkIfFavorited();
        this.checkIfBoosted();
    }

    reply(): boolean {
        this.replyEvent.emit();
        return false;
    }

    boost(): boolean {
        this.selectedAccounts.forEach((account: AccountInfo) => {
            const isProvider = this.statusWrapper.provider.id === account.id;

            let pipeline: Promise<Status> = Promise.resolve(this.statusWrapper.status);

            if (!isProvider) {
                pipeline = pipeline.then((foreignStatus: Status) => {
                    const statusUrl = foreignStatus.url;
                    return this.mastodonService.search(account, statusUrl)
                        .then((results: Results) => {
                            //TODO check and type errors
                            return results.statuses[0];
                        });
                });
            }

            pipeline
                .then((status: Status) => {
                    if (this.isBoosted) {
                        return this.mastodonService.unreblog(account, status);
                    } else {
                        return this.mastodonService.reblog(account, status);
                    }
                })
                .then((boostedStatus: Status) => {
                    this.bootedStatePerAccountId[account.id] = boostedStatus.reblogged;
                    this.checkIfBoosted();
                    // this.isBoosted = !this.isBoosted;
                })
                .catch(err => {
                    console.error(err);
                });
        });

        return false;
    }

    favorite(): boolean {
        this.selectedAccounts.forEach((account: AccountInfo) => {
            const isProvider = this.statusWrapper.provider.id === account.id;

            let pipeline: Promise<Status> = Promise.resolve(this.statusWrapper.status);

            if (!isProvider) {
                pipeline = pipeline.then((foreignStatus: Status) => {
                    const statusUrl = foreignStatus.url;
                    return this.mastodonService.search(account, statusUrl)
                        .then((results: Results) => {
                            //TODO check and type errors
                            return results.statuses[0];
                        });
                });
            }

            pipeline
                .then((status: Status) => {
                    if (this.isFavorited) {
                        return this.mastodonService.unfavorite(account, status);
                    } else {
                        return this.mastodonService.favorite(account, status);
                    }
                })
                .then((favoritedStatus: Status) => {
                    this.favoriteStatePerAccountId[account.id] = favoritedStatus.favourited;
                    this.checkIfFavorited();
                    // this.isFavorited = !this.isFavorited;
                })
                .catch(err => {
                    console.error(err);
                });
        });
        return false;
    }

    private checkIfBoosted() {
        const selectedAccount = <AccountInfo>this.selectedAccounts[0];
        if (selectedAccount) {
            this.isBoosted = this.bootedStatePerAccountId[selectedAccount.id];
        } else {
            this.isBoosted = false;
        }
    }

    private checkIfFavorited() {
        const selectedAccount = <AccountInfo>this.selectedAccounts[0];

        if (selectedAccount) {
            this.isFavorited = this.favoriteStatePerAccountId[selectedAccount.id];
        } else {
            this.isFavorited = false;
        }
    }

    more(): boolean {
        console.warn('more'); //TODO
        return false;
    }

    private getSelectedAccounts(): AccountInfo[] {
        var regAccounts = <AccountInfo[]>this.store.snapshot().registeredaccounts.accounts;
        return regAccounts;
    }
}
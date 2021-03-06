import Currency = GameConstants.Currency;

class Breeding implements Feature {
    name = 'Breeding';
    saveKey = 'breeding';

    defaults = {
        'eggList': [ko.observable(new Egg()), ko.observable(new Egg()), ko.observable(new Egg()), ko.observable(new Egg())],
        'eggSlots': 1,
    };

    private _eggList: Array<KnockoutObservable<Egg>>;
    private _eggSlots: KnockoutObservable<number>;

    private hatchList: { [name: number]: string[][] } = {};

    constructor() {
        this._eggList = this.defaults.eggList;
        this._eggSlots = ko.observable(this.defaults.eggSlots);
    }

    initialize(): void {
        this.hatchList[EggType.Fire] = [
            ['Charmander', 'Vulpix', 'Growlithe', 'Ponyta'],
            ['Cyndaquil', 'Slugma', 'Houndour', 'Magby'],
        ];
        this.hatchList[EggType.Water] = [
            ['Squirtle', 'Lapras', 'Staryu', 'Psyduck'],
            ['Totodile', 'Wooper', 'Marill', 'Qwilfish'],
        ];
        this.hatchList[EggType.Grass] = [
            ['Bulbasaur', 'Oddish', 'Tangela', 'Bellsprout'],
            ['Chikorita', 'Hoppip', 'Sunkern'],
        ];
        this.hatchList[EggType.Fighting] = [
            ['Hitmonlee', 'Hitmonchan', 'Machop', 'Mankey'],
            ['Tyrogue'],
        ];
        this.hatchList[EggType.Electric] = [
            ['Magnemite', 'Pikachu', 'Voltorb', 'Electabuzz'],
            ['Chinchou', 'Mareep', 'Elekid'],
        ];
        this.hatchList[EggType.Dragon] = [
            ['Dratini', 'Dragonair', 'Dragonite'],
            [],
        ];

    }

    update(delta: number): void {
    }

    canAccess(): boolean {
        return App.game.keyItems.hasKeyItem(KeyItems.KeyItem.Mystery_egg);
    }

    fromJSON(json: object): void {
        if (json == null) {
            return;
        }

        this.eggSlots = json['eggSlots'] ?? this.defaults.eggSlots;

        if (json['eggList'] == null) {
            this._eggList = this.defaults.eggList;
        } else {
            const saveEggList: object[] = json['eggList'];

            for (let i = 0; i < this._eggList.length; i++) {
                if (saveEggList[i] != null) {
                    const egg: Egg = new Egg(null, null, null);
                    egg.fromJSON(saveEggList[i]);
                    this._eggList[i](egg);
                }
            }
        }
    }


    toJSON(): object {
        const breedingSave = {};
        breedingSave['eggList'] = this.eggList.map(function (egg: any) {
            return egg() === null ? new Egg() : egg().toJSON();
        }
        );
        breedingSave['eggSlots'] = this.eggSlots;
        return breedingSave;
    }

    public canBreedPokemon(): boolean {
        return App.game.party.hasMaxLevelPokemon() && this.hasFreeEggSlot();
    }

    public hasFreeEggSlot(): boolean {
        let counter = 0;
        for (const egg of this._eggList) {
            if (!egg().isNone()) {
                counter++;
            }
        }
        return counter < this._eggSlots();
    }

    public gainEgg(e: Egg) {
        for (let i = 0; i < this._eggList.length; i++) {
            if (this._eggList[i]().isNone()) {
                this._eggList[i](e);
                return true;
            }
        }
        console.error(`Error: Could not place ${EggType[e.type]} Egg`);
        return false;
    }

    public gainRandomEgg() {
        return this.gainEgg(this.createRandomEgg());
    }

    public progressEggs(amount: number) {
        amount *= App.game.oakItems.calculateBonus(OakItems.OakItem.Blaze_Cassette);

        amount = Math.round(amount);
        for (const egg of this._eggList) {
            egg().addSteps(amount);
        }
    }

    public gainPokemonEgg(pokemon: PartyPokemon) {
        if (!this.hasFreeEggSlot()) {
            Notifier.notify("You don't have any free egg slots", GameConstants.NotificationOption.warning);
            return;
        }
        const egg = this.createEgg(pokemon.name);
        pokemon.breeding = true;
        this.gainEgg(egg);
    }

    public hatchPokemonEgg(index: number) {
        const egg: Egg = this._eggList[index]();
        egg.hatch();
        this._eggList[index](new Egg());
    }

    public createEgg(pokemonName: string, type = EggType.Pokemon): Egg {
        const dataPokemon: DataPokemon = PokemonHelper.getPokemonByName(pokemonName);
        return new Egg(type, this.getSteps(dataPokemon.eggCycles), pokemonName);
    }

    public createTypedEgg(type: EggType): Egg {
        const hatchList = this.hatchList[type];
        const hatchable = hatchList.slice(0, player.highestRegion() + 1);
        let possibleHatches = [];
        hatchable.forEach((pokemon, index) => {
            if (!pokemon.length) {
                return;
            }
            const toAdd = possibleHatches.length || 1;
            for (let i = 0; i < toAdd; i++) {
                possibleHatches.push(pokemon);
            }
        });
        possibleHatches = possibleHatches[Math.floor(Math.random() * possibleHatches.length)];
        const pokemon = possibleHatches[Math.floor(Math.random() * possibleHatches.length)];
        return this.createEgg(pokemon, type);
    }

    public createRandomEgg(): Egg {
        const type = Math.floor(Math.random() * (Object.keys(this.hatchList).length - 1));
        const egg = this.createTypedEgg(type);
        egg.type = EggType.Mystery;
        return egg;
    }

    public createFossilEgg(fossil: string): Egg {
        const pokemonName = GameConstants.FossilToPokemon[fossil];
        return this.createEgg(pokemonName, EggType.Fossil);
    }

    public getSteps(eggCycles: number) {
        if (eggCycles === undefined) {
            return 500;
        } else {
            return eggCycles * 40;
        }
    };

    public getEggSlotCost(slot: number): number {
        return 500 * slot;
    }

    public calculateBaseForm(pokemonName: string): string {
        const devolution = pokemonDevolutionMap[pokemonName];
        // Base form of Pokemon depends on which regions players unlocked
        if (!devolution || PokemonHelper.calcNativeRegion(devolution) > player.highestRegion()) {
            // No devolutions at all
            // No further devolutions in current unlocked regions
            return pokemonName;
        } else {
            // Recurse onto its devolution
            return this.calculateBaseForm(devolution);
        }
    }

    public buyEggSlot() {
        const cost: Amount = this.nextEggSlotCost();
        if (App.game.wallet.hasAmount(cost)) {
            App.game.wallet.loseAmount(cost);
            this.gainEggSlot();
        }
    }

    public nextEggSlotCost(): Amount {
        return new Amount(this.getEggSlotCost(this.eggSlots + 1), Currency.questPoint);
    }

    // Knockout getters/setters
    get eggSlots(): number {
        return this._eggSlots();
    }

    set eggSlots(value: number) {
        this._eggSlots(value);
    }

    public gainEggSlot() {
        this.eggSlots += 1;
    }

    get eggList(): Array<KnockoutObservable<Egg>> {
        return this._eggList;
    }

    set eggList(value: Array<KnockoutObservable<Egg>>) {
        this._eggList = value;
    }

}
